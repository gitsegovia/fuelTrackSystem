// Corre la fase B (sesión con refresh rotativo, T-010) de punta a punta: verifica que la API del
// stack de verificación tenga sesión corta, construye station contra el proxy cortable, levanta
// proxy y vite preview, ejecuta sesion-e2e.mjs y apaga todo lo que levantó, aunque falle.
// Ver e2e/README.md.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { APP, PASSWORD, PROXY_CONTROL, USER } from './lib.mjs'
import { COMPOSE_HINT, killTree, makeRunner, makeSpawner, probe, waitFor, portBusy, waitPortsFree } from './run-common.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const stationDir = join(here, '..')
const PROXY_URL = process.env.E2E_PROXY_URL ?? 'http://localhost:4501/graphql'
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4500/graphql'
const PREVIEW_PORT = new URL(APP).port || '3001'
const PROXY_PORT = new URL(PROXY_URL).port
const CONTROL_PORT = new URL(PROXY_CONTROL).port
const PORTS = [PREVIEW_PORT, PROXY_PORT, CONTROL_PORT]
const children = []
const start = makeSpawner(children, stationDir)
const run = makeRunner(start)

const SHORT_SESSION_HINT =
  'ACCESS_TOKEN_MINUTES=1 SESSION_MAX_HOURS=0.05 ' + COMPOSE_HINT +
  '\n  (si el stack ya está arriba con la sesión normal, bájalo primero: ' +
  'docker compose -f docker-compose.verify.yml -p ft-station-e2e down -v)'

/** La fase B necesita un access token de minutos, no de la config normal (15 min por defecto).
 * Se verifica haciendo un login real en vez de leer variables de entorno del contenedor: así
 * funciona sin importar cómo se haya levantado el stack, y es justo lo que la prueba necesita. */
async function checkShortSession() {
  let json
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation Login($input: LoginInput!) { login(input: $input) { accessTokenExpiresAt } }',
        variables: { input: { username: USER, password: PASSWORD } },
      }),
    })
    json = await res.json()
  } catch (e) {
    throw new Error(`No se pudo consultar la API de verificación (${API_URL}): ${e.message}`)
  }
  const expiresAt = json?.data?.login?.accessTokenExpiresAt
  if (!expiresAt) {
    throw new Error(`El login de prueba falló contra ${API_URL}: ${JSON.stringify(json?.errors ?? json)}`)
  }
  const minutesToExpiry = (new Date(expiresAt).getTime() - Date.now()) / 60_000
  // Con margen: ACCESS_TOKEN_MINUTES=1 da ~1 min; la config normal da 15. 3 min separa bien los dos casos.
  if (minutesToExpiry > 3) {
    throw new Error(
      `El access token de la API dura ~${minutesToExpiry.toFixed(1)} min — la fase B necesita sesión corta ` +
      `(ACCESS_TOKEN_MINUTES=1). Reinicia el stack de verificación con:\n  ${SHORT_SESSION_HINT}`
    )
  }
}

async function main() {
  // 1. Stack de verificación arriba, con sesión corta.
  if ((await probe(API_URL)) === 0) {
    console.error(`La API de verificación no responde en ${API_URL}.\nLevántala con:\n  ${SHORT_SESSION_HINT}`)
    return 2
  }
  try {
    await checkShortSession()
  } catch (e) {
    console.error(e.message)
    return 2
  }

  // 2. Puertos libres (no se matan procesos ajenos).
  for (const [port, label] of [[PREVIEW_PORT, 'station preview'], [PROXY_PORT, 'proxy'], [CONTROL_PORT, 'control del proxy']]) {
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

  // 4. Fase B (~5 min: opera más de 2 min, luego espera a que venza la sesión). Pase lo que
  // pase, el finally apaga los procesos.
  const testCode = await run('node', [join(here, 'sesion-e2e.mjs')])
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
  console.error('[e2e:sesion:all]', e.message)
  exitCode = 1
} finally {
  for (const c of children) killTree(c)
  await waitPortsFree(PORTS)
  console.log(`[e2e:sesion:all] apagado. Código de salida: ${exitCode}`)
}
process.exit(exitCode)
