// Primitivas compartidas por los runners autocontenidos (run.mjs, run-sesion.mjs): sondear un
// puerto/URL, esperar a que responda, verificar que un puerto esté libre, y lanzar/matar
// procesos hijos de forma que el padre nunca los deje huérfanos.
import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'

export const isWin = process.platform === 'win32'

export const COMPOSE_HINT =
  'docker compose -f docker-compose.verify.yml -p ft-station-e2e up -d --build   (desde la raíz del repo)'

export function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', () => resolve(0))
    req.setTimeout(2000, () => { req.destroy(); resolve(0) })
  })
}

export async function waitFor(url, label, timeoutMs = 90_000, accept = (code) => code > 0) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (accept(await probe(url))) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`${label} no respondió en ${timeoutMs / 1000} s (${url})`)
}

export function portBusy(port) {
  return new Promise((resolve) => {
    const srv = http.createServer()
    srv.once('error', () => resolve(true))
    srv.once('listening', () => srv.close(() => resolve(false)))
    srv.listen(port)
  })
}

export function killTree(child) {
  if (!child || child.exitCode !== null) return
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

/** Lanza un proceso hijo con stdio heredado; devuelve el child y lo agrega a `children` para
 * que el runner lo pueda matar en el finally pase lo que pase. */
export function makeSpawner(children, cwd) {
  return function start(cmd, args, opts = {}) {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: isWin, ...opts })
    children.push(child)
    return child
  }
}

/** Como start(), pero espera a que el proceso termine y resuelve con su código de salida. */
export function makeRunner(start) {
  return function run(cmd, args, opts = {}) {
    return new Promise((resolve) => {
      const child = start(cmd, args, opts)
      child.on('exit', (code) => resolve(code ?? 1))
    })
  }
}

/** Espera a que los puertos dados queden libres (hasta ~10 s), para el mensaje final. */
export async function waitPortsFree(ports, timeoutMs = 10_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const busy = await Promise.all(ports.map((p) => portBusy(Number(p))))
    if (!busy.some(Boolean)) return
    await new Promise((r) => setTimeout(r, 500))
  }
}
