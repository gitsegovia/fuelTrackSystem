# Offline-first — Fase pendiente

## Estado actual

La infraestructura base fue construida pero se pausó por incompatibilidades estructurales con Next.js SSR + Apollo Client v4. Lo que existe y funciona:

| Archivo | Estado | Qué hace |
|---|---|---|
| `src/lib/apollo-client.ts` | ✅ Activo | Cache persistence con `apollo3-cache-persist` + custom `ApolloLink` para detección de errores de red |
| `src/lib/offline-db.ts` | ✅ Activo | IndexedDB wrapper para la cola de mutations (enqueue, dequeue, retry) |
| `src/context/OfflineContext.tsx` | ✅ Activo | Detección online/offline, processQueue, sync triggers |
| `src/components/layout/OfflineBanner.tsx` | ✅ Activo | Banner visual de estado (offline / sincronizando / error / completado) |
| `public/sw.js` | ⚠ Solo producción | Service Worker básico — no registrado en dev para no interferir con HMR |

## Qué funciona hoy

- **Cache persistence**: Apollo cache persiste en `localStorage`. Al refrescar la página, los datos de la sesión anterior aparecen antes de que llegue la respuesta del servidor.
- **Detección de estado de red**: el banner aparece al ir offline y desaparece al reconectar.
- **Cola de mutations en IndexedDB**: la infraestructura está lista — `enqueue`/`dequeue`/`retry` funcionan correctamente.

## Qué NO funciona aún

- **Encolado de mutations en Firefox**: Firefox reporta una conexión caída como error CORS (`statusCode: null`). La detección por `isNetworkDown()` cubre los patrones conocidos pero no fue validada completamente.
- **Auto-sync al reconectar**: el evento `window.online` de Chrome/Firefox DevTools no siempre es confiable. Los triggers de `focus`/`visibilitychange` son el fallback.
- **Crear tickets mientras se está offline**: no implementado — requeriría IDs temporales locales y reconciliación con los IDs reales del servidor al sincronizar.

## Problema de fondo

Next.js renderiza las páginas en el servidor (SSR). El servidor no tiene acceso a `navigator.onLine`, `IndexedDB`, `localStorage` ni `ServiceWorker`. Esto genera:

- **Hydration mismatches**: el servidor renderiza con `isOnline = true` pero el cliente puede hidratar con `isOnline = false`, produciendo un mismatch de HTML que React lanza como error
- **Performance.measure errors**: la inicialización asíncrona del Apollo Client crea una ventana donde Turbopack/Apollo intenta medir performance con timestamps inválidos
- **Service Worker + HMR**: el SW en desarrollo intercepta los chunks de Turbopack y rompe el Hot Module Replacement

## Plan de migración (cuando se retome)

### Opción A — Separar `/station` como app estática (recomendada)
Extraer el panel estación a una aplicación Vite + React (o Next.js con `output: 'export'`) sin SSR. Las browser APIs están disponibles desde el primer render. Workbox maneja el Service Worker de forma limpia.

```
project_fuelTrack/
├── apps/web/          → Admin panel (Next.js SSR, sin offline-first)
├── apps/station/      → Station panel (Vite PWA, offline-first completo)
└── apps/api/          → GraphQL API (sin cambios)
```

### Opción B — Capacitor / Tauri (app nativa)
Empaquetar el panel estación como app de escritorio o móvil. Acceso total a APIs del sistema operativo, SQLite local, sync nativa.

### Opción C — Next.js con `use client` agresivo
Desactivar SSR solo para las rutas `/station/*` usando `dynamic(() => import(...), { ssr: false })` en el layout. Elimina el problema de hydration pero pierde los beneficios de SSR (ya mínimos para un panel operacional interno).

## Implementación futura de la cola

Cuando se retome, las mutations prioritarias a encolar son:

```typescript
// En orden de criticidad operacional:
'CreateSalesTicket'          // Crear ticket
'ProcessSalesTicketDispatch' // Registrar despacho
'CreatePayments'             // Registrar pago
'CreateDispenserReading'     // Lecturas de surtidor
'EndEmployeeShift'           // Cerrar turno
'CreateTankMeasurement'      // Medición de tanque
```

El challenge de `CreateSalesTicket` → `ProcessSalesTicketDispatch` → `CreatePayments` en cadena es que cada step depende del ID del anterior. Requiere un sistema de IDs temporales (UUID local) con reconciliación al sincronizar — similar a lo que hace Apollo Offline o WatermelonDB.
