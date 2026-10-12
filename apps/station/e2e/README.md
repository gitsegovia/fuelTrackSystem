# E2E de station (Playwright)

Pruebas de navegador del panel de estación contra la API de verificación (T-030 / T-035 / T-040).
Usan Chrome instalado en la máquina (`channel: 'chrome'`); no descargan navegadores.

## Fase A: offline, sync, cobro, reporte, tanques — un solo comando

Requisito: el stack de verificación levantado desde la raíz del repo, con la sesión por defecto.

```bash
docker compose -f docker-compose.verify.yml -p ft-station-e2e up -d --build
pnpm --filter station e2e:all
docker compose -f docker-compose.verify.yml -p ft-station-e2e down -v
```

`e2e:all` (`e2e/run.mjs`) hace, en orden:

1. Comprueba que la API responde en `http://localhost:4500/graphql`. Si no, sale con el comando
   de levantamiento. No levanta ni baja el stack (es compartido con ft-api).
2. Comprueba que los puertos 3001, 4501 y 4502 estén libres. No mata procesos ajenos.
3. Construye station con `VITE_GRAPHQL_URI=http://localhost:4501/graphql`.
4. Levanta el proxy cortable (`e2e/proxy.mjs`) y `vite preview` en el puerto 3001.
5. Corre `e2e/offline-e2e.mjs` (flujo offline completo —turno, lecturas, ticket postpago con
   cobro parcial en otra moneda, cierre—, sync al reconectar, un ticket **prepago íntegramente
   offline** con diferencial verificado tras sincronizar, reporte de turno, `/tanks`, error de
   negocio en `/sync`).
6. Apaga proxy y preview **siempre**, aunque algún paso falle, y verifica que los puertos queden libres.

Después corre `e2e/permisos-e2e.mjs` (T-044, ADR-016): el cajero ve "Registrar pago" en un ticket
despachado y el bombero no; y un cierre de turno del cajero encolado offline, rechazado con
FORBIDDEN tras cambiarle el cargo en la BD, llega a `/sync` con el mensaje de permiso.

Usuarios: los flujos de punta a punta entran como `mgr.norte` (gerente, todas las acciones de
estación según la matriz). Los casos por cargo usan `cajero.norte` y `bombero1.norte`.

Por último corre `e2e/licencia-e2e.mjs` (T-052). El stack de verificación está en modo LEGACY, así
que el proxy simula el modo CCI1: `GET /license?status=DUE_SOON|GRACE|READ_ONLY[&skew=1]` responde
`LicenseStatus` con ese estado, y `GET /reject?op=<Operación>` responde esa mutation con
`LICENSE_READ_ONLY` (`/rejected` cuenta los envíos). Comprueba que LEGACY no muestra nada, las
tres franjas, el aviso de reloj, que READ_ONLY oculta las escrituras y se ve tras recargar sin red,
y que una operación encolada que vuelve con `LICENSE_READ_ONLY` va a conflictos con un solo envío
mientras la siguiente de la cola se aplica.
Con el contrato v2 (T-060) también cubre la prueba gratis (`/license?status=DUE_SOON&trial=1`) y
`STATION_NOT_LICENSED` (`/reject?op=…&code=STATION_NOT_LICENSED`): en la cola (un solo envío, a
conflictos), en `RefreshSession` (cierra la sesión con el aviso y la cola intacta) y en `Login`.

Al final corre `e2e/estacion-e2e.mjs` (T-057, D-19) sobre la Estación Sur: `bombero1.sur` encola
una medición sin red, el admin desactiva Sur con `deactivateGasStation` (antes se cierran por SQL sus
turnos y tickets abiertos), la medición vuelve con `STATION_INACTIVE` y va a conflictos con un solo
envío (`GET /count?op=…` y `/counted` del proxy), la renovación con `STATION_INACTIVE` cierra la
sesión con el aviso y la cola intacta, y `cajero.sur` ve el aviso en el login. Al terminar reactiva
Sur por SQL (la API no tiene mutation de reactivación).

El código de salida es 0 solo si pasan los cuatro scripts.

## Fase B: sesión con token corto — también un solo comando

Necesita la API con sesión corta (`ACCESS_TOKEN_MINUTES=1 SESSION_MAX_HOURS=0.05`). Es un
comando aparte porque cambia la configuración del stack:

```bash
ACCESS_TOKEN_MINUTES=1 SESSION_MAX_HOURS=0.05 \
  docker compose -f docker-compose.verify.yml -p ft-station-e2e up -d --build
pnpm --filter station e2e:sesion:all
docker compose -f docker-compose.verify.yml -p ft-station-e2e down -v
```

`e2e:sesion:all` (`e2e/run-sesion.mjs`) hace lo mismo que `run.mjs` (build, proxy, preview,
apagado garantizado), más un paso previo: hace un login real contra la API y mide cuánto dura el
access token devuelto. Si dura más de 3 minutos (la config normal da 15), sale con el comando
exacto para reiniciar el stack en sesión corta — así nunca corre media hora contra la API
equivocada ni exige leer las variables del contenedor a mano. Luego corre `e2e/sesion-e2e.mjs`.

La fase B tarda unos 5 minutos: opera más de 2 min con renovaciones de sesión, deja la sesión
vencer sin red con la cola intacta, y verifica el envío tras re-login.

Si preferís levantar station y el proxy a mano en vez de `e2e:sesion:all` (por ejemplo para
correr `pnpm --filter station e2e:sesion` sueltos varias veces sin reconstruir cada vez):

```bash
cd apps/station
VITE_GRAPHQL_URI=http://localhost:4501/graphql pnpm build
node e2e/proxy.mjs &
pnpm exec vite preview --port 3001 --strictPort &
pnpm e2e:sesion
```

## Variables de entorno (opcionales)

| Variable | Default | Uso |
|---|---|---|
| `E2E_APP` | `http://localhost:3001` | Dónde responde station |
| `E2E_PROXY_CONTROL` | `http://localhost:4502` | Control del proxy (`/down`, `/up`, `/state`) |
| `E2E_DB_CONTAINER` | `ft-station-e2e-verify-db-1` | Contenedor de Postgres para las consultas SQL |
| `E2E_API_URL` | `http://localhost:4500/graphql` | Chequeo de la API en `run.mjs` |
| `E2E_PROXY_URL` | `http://localhost:4501/graphql` | Endpoint con el que se construye station |
| `E2E_PROXY_CONTROL_PORT` / `E2E_PROXY_PORT` / `E2E_API_PORT` | `4502` / `4501` / `4500` | Puertos del proxy (y su upstream). Con los puertos de `E2E_*` se puede correr junto a otro stack |

Para correr en puertos alternos (otro agente o worktree ya usa 4500–4502 y 3001): levantar el
stack con `VERIFY_API_PORT=4510` y exportar `E2E_API_URL=http://localhost:4510/graphql`,
`E2E_API_PORT=4510`, `E2E_PROXY_PORT=4511`, `E2E_PROXY_URL=http://localhost:4511/graphql`,
`E2E_PROXY_CONTROL_PORT=4512`, `E2E_PROXY_CONTROL=http://localhost:4512`, `E2E_APP=http://localhost:3011`.

## Capturas de fallo

Se guardan en el directorio temporal del sistema, `ft-station-e2e/fail-N.png`. `run.mjs` lo
imprime al final.

## Qué no cubre

- Dos pestañas abiertas a la vez: cubierto por la simulación de T-010, no por el navegador.
- Dashboard "hoy" (T-017 punto 5).
- Web (`apps/web`).
