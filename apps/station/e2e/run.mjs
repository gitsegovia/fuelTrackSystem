// Corre el E2E offline completo (fase A) de punta a punta: verifica el stack de verificación,
// construye station contra el proxy cortable, levanta proxy y vite preview, ejecuta
// offline-e2e.mjs y apaga todo lo que levantó, aunque falle. Ver e2e/README.md.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { APP, PROXY_CONTROL } from './lib.mjs'
import { COMPOSE_HINT, killTree, makeRunner, makeSpawner, probe, waitFor, portBusy, waitPortsFree } from './run-common.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const stationDir = join(here, '..')
const PROXY_URL = process.env.E2E_PROXY_URL ?? 'http://localhost:4501/graphql'
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4500/graphql'
const PREVIEW_PORT = new URL(APP).port || '3001'
const PORTS = [PREVIEW_PORT, 4501, 4502]
const children = []
const start = makeSpawner(children, stationDir)
const run = makeRunner(start)

async function main() {
  // 1. Stack de verificación arriba (no lo levanta: es compartido con ft-api).
  if ((await probe(API_URL)) === 0) {
    console.error(`La API de verificación no responde en ${API_URL}.\nLevántala con:\n  ${COMPOSE_HINT}`)
    return 2
  }

  // 2. Puertos libres (no se matan procesos ajenos).
  for (const [port, label] of [[PREVIEW_PORT, 'station preview'], [4501, 'proxy'], [4502, 'control del proxy']]) {
    if (await portBusy(Number(port))) {
      console.error(`El puerto ${port} (${label}) ya está en uso. Libéralo antes de correr el E2E.`)
      return 2
    }
  }

  // 3. Build de station apuntando al proxy, luego vite preview y proxy.
  const buildCode = await run('pnpm', ['build'], { env: { ...process.env, VITE_GRAPHQL_URI: PROXY_URL } })
  if (buildCode !== 0) {
    console.error('El build de station falló.')
    return buildCode
  }
  start('node', [join(here, 'proxy.mjs')])
  start('pnpm', ['exec', 'vite', 'preview', '--port', PREVIEW_PORT, '--strictPort'])
  await waitFor(PROXY_CONTROL + '/state', 'proxy de control', 30_000)
  await waitFor(APP + '/login', 'station preview', 60_000, (code) => code === 200)

  // 4. Fase A. Pase lo que pase, el finally apaga los procesos.
  const testCode = await run('node', [join(here, 'offline-e2e.mjs')])
  return testCode
}

process.on('SIGINT', () => {
  for (const c of children) killTree(c)
  process.exit(130)
})

let exitCode = 1
try {
  exitCode = await main()
} catch (e) {
  console.error('[e2e:all]', e.message)
  exitCode = 1
} finally {
  for (const c of children) killTree(c)
  await waitPortsFree(PORTS)
  console.log(`[e2e:all] apagado. Código de salida: ${exitCode}`)
}
process.exit(exitCode)
