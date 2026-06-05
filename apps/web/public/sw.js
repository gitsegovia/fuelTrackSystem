const CACHE_NAME = 'fueltrack-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // No interceptar requests a la API GraphQL — la cola de mutations maneja los errores
  if (url.port === '4000' || url.pathname.endsWith('/graphql')) return

  // No interceptar requests POST/PUT/DELETE
  if (request.method !== 'GET') return

  // Archivos estáticos de Next.js: cache-first (no cambian entre visitas)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return response
          })
      )
    )
    return
  }

  // Navegación (HTML): network-first, cache si hay — sin fallback a '/' para evitar loops
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          // Solo servir del cache la página exacta — si no está, dejar fallar limpiamente
          caches.match(request)
        )
    )
  }
})
