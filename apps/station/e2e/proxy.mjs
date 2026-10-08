// Proxy cortable entre station y la API de verificación. Simula la caída de red también para
// las requests que pasan por el Service Worker. Lo levanta e2e/run.mjs; también se puede correr a mano.
//
// Control (GET en el puerto de control):
//   /down | /up | /state           cortar o restablecer la red
//   /license?status=S[&skew=1]     responder LicenseStatus como modo CCI1 con estado S (T-052)
//   /license/off                   dejar pasar LicenseStatus a la API (LEGACY en el stack de verificación)
//   /reject?op=Name                responder la operación Name con LICENSE_READ_ONLY (T-052)
//   /reject/off                    dejar de rechazar
//   /rejected                      cuántas veces se rechazó (para comprobar que no hubo reintentos)
import http from 'node:http'

const PROXY_PORT = Number(process.env.E2E_PROXY_PORT ?? 4501)
const CONTROL_PORT = Number(process.env.E2E_PROXY_CONTROL_PORT ?? 4502)
const API_PORT = Number(process.env.E2E_API_PORT ?? 4500)

let up = true
let fakeLicense = null
let rejectOp = null
let rejectedCount = 0

const DAY = 86_400_000

function licenseFor(status, skew) {
  const now = Date.now()
  const shape = {
    ACTIVE: { expiresAt: now + 90 * DAY, graceEndsAt: now + 97 * DAY, daysRemaining: 90, readOnly: false },
    DUE_SOON: { expiresAt: now + 10 * DAY, graceEndsAt: now + 17 * DAY, daysRemaining: 10, readOnly: false },
    GRACE: { expiresAt: now - 3 * DAY, graceEndsAt: now + 4 * DAY, daysRemaining: -3, readOnly: false },
    READ_ONLY: { expiresAt: now - 20 * DAY, graceEndsAt: now - 13 * DAY, daysRemaining: -20, readOnly: true },
  }[status]
  return {
    __typename: 'LicenseStatusInfo',
    mode: 'CCI1',
    status,
    expiresAt: new Date(shape.expiresAt).toISOString(),
    graceEndsAt: new Date(shape.graceEndsAt).toISOString(),
    daysRemaining: shape.daysRemaining,
    readOnly: shape.readOnly,
    clockSkewDetected: skew,
  }
}

function forward(req, res, body) {
  const headers = { ...req.headers }
  if (body) headers['content-length'] = Buffer.byteLength(body)
  const upstream = http.request(
    { host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers },
    (ures) => {
      res.writeHead(ures.statusCode ?? 502, ures.headers)
      ures.pipe(res)
    }
  )
  upstream.on('error', () => req.socket.destroy())
  if (body) upstream.end(body)
  else req.pipe(upstream)
}

function reply(req, res, payload) {
  const origin = req.headers.origin
  res.writeHead(200, {
    'content-type': 'application/json',
    ...(origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'Origin' } : {}),
  })
  res.end(JSON.stringify(payload))
}

http
  .createServer((req, res) => {
    if (!up) {
      req.socket.destroy()
      return
    }
    if (req.method !== 'POST' || (!fakeLicense && !rejectOp)) return forward(req, res)

    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      let op = null
      try { op = JSON.parse(body).operationName } catch {}
      if (fakeLicense && op === 'LicenseStatus') {
        return reply(req, res, { data: { licenseStatus: licenseFor(fakeLicense.status, fakeLicense.skew) } })
      }
      if (rejectOp && op === rejectOp) {
        rejectedCount++
        return reply(req, res, {
          data: null,
          errors: [{ message: 'Licencia vencida (simulada por el proxy E2E)', extensions: { code: 'LICENSE_READ_ONLY' } }],
        })
      }
      forward(req, res, body)
    })
  })
  .listen(PROXY_PORT, () => console.log(`proxy :${PROXY_PORT} -> api :${API_PORT}`))

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://control')
    if (url.pathname === '/down') up = false
    if (url.pathname === '/up') up = true
    if (url.pathname === '/license') fakeLicense = { status: url.searchParams.get('status'), skew: url.searchParams.get('skew') === '1' }
    if (url.pathname === '/license/off') fakeLicense = null
    if (url.pathname === '/reject') { rejectOp = url.searchParams.get('op'); rejectedCount = 0 }
    if (url.pathname === '/reject/off') rejectOp = null
    if (url.pathname === '/rejected') return res.end(String(rejectedCount))
    res.end(up ? 'up' : 'down')
  })
  .listen(CONTROL_PORT, () => console.log(`control :${CONTROL_PORT}`))
