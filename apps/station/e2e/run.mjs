// Corre el E2E offline completo (fase A) de punta a punta: verifica el stack de verificación,
// construye station contra el proxy cortable, levanta proxy y vite preview, ejecuta
// offline-e2e.mjs y apaga todo lo que levantó, aunque falle. Ver e2e/README.md.
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import http from 'node:http'
import { APP, PROXY_CONTROL } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const stationDir = join(here, '..')
const PROXY_URL = process.env.E2E_PROXY_URL ?? 'http://localhost:4501/graphql'
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4500/graphql'
const PREVIEW_PORT = new URL(APP).port || '3001'
const isWin = process.platform === 'win32'
const children = []

const COMPOSE_HINT =
  'docker compose -f docker-compose.verify.yml -p ft-station-e2e up -d --build   (desde la raíz del repo)'

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', () => resolve(0))
    req.setTimeout(2000, () => { req.destroy(); resolve(0) })
  })
}

async function waitFor(url, label, timeoutMs = 90_000, accept = (code) => code > 0) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (accept(await probe(url))) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`${label} no respondió en ${timeoutMs / 1000} s (${url})`)
}

function portBusy(port) {
  return new Promise((resolve) => {
    const srv = http.createServer()
    srv.once('error', () => resolve(true))
    srv.once('listening', () => srv.close(() => resolve(false)))
    srv.listen(port)
  })
}

function killTree(child) {
  if (!child || child.exitCode !== null) return
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

function start(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { cwd: stationDir, stdio: 'inherit', shell: isWin, ...opts })
  children.push(child)
  return child
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = start(cmd, args, opts)
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

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
  // Esperar a que se liberen los puertos que levantamos.
  for (let i = 0; i < 20; i++) {
    const busy = [await portBusy(Number(PREVIEW_PORT)), await portBusy(4501), await portBusy(4502)]
    if (!busy.some(Boolean)) break
    await new Promise((r) => setTimeout(r, 500))
  }
  console.log(`[e2e:all] apagado. Código de salida: ${exitCode}`)
}
process.exit(exitCode)
