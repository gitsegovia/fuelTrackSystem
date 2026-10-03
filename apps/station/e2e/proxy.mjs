// Proxy cortable entre station y la API de verificación. Simula la caída de red también para
// las requests que pasan por el Service Worker. Control: GET /down | /up | /state en el puerto
// de control. Lo levanta e2e/run.mjs; también se puede correr a mano.
import http from 'node:http'

const PROXY_PORT = Number(process.env.E2E_PROXY_PORT ?? 4501)
const CONTROL_PORT = Number(process.env.E2E_PROXY_CONTROL_PORT ?? 4502)
const API_PORT = Number(process.env.E2E_API_PORT ?? 4500)

let up = true

http
  .createServer((req, res) => {
    if (!up) {
      req.socket.destroy()
      return
    }
    const upstream = http.request(
      { host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: req.headers },
      (ures) => {
        res.writeHead(ures.statusCode ?? 502, ures.headers)
        ures.pipe(res)
      }
    )
    upstream.on('error', () => req.socket.destroy())
    req.pipe(upstream)
  })
  .listen(PROXY_PORT, () => console.log(`proxy :${PROXY_PORT} -> api :${API_PORT}`))

http
  .createServer((req, res) => {
    if (req.url === '/down') up = false
    if (req.url === '/up') up = true
    res.end(up ? 'up' : 'down')
  })
  .listen(CONTROL_PORT, () => console.log(`control :${CONTROL_PORT}`))
