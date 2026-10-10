// E2E de station en navegador (T-052): avisos de licencia y LICENSE_READ_ONLY en la cola offline.
// El stack de verificación corre en modo LEGACY; el proxy simula el modo CCI1 (respuesta de
// LicenseStatus) y el rechazo LICENSE_READ_ONLY de una operación concreta.
//
// Casos:
//   1. LEGACY: sin franja de licencia.
//   2. Cola: medición de tanque y cierre de turno encolados offline; al reconectar, la medición
//      vuelve con LICENSE_READ_ONLY → conflictos sin reintentos (1 solo envío) y el cierre se aplica.
//   3. DUE_SOON y GRACE: franja con la fecha.
//   4. READ_ONLY + reloj atrasado: franja fija y aviso de reloj; sin acciones de escritura.
//   5. READ_ONLY sigue visible tras recargar sin red (último estado del cache persistido).
//
// Requisitos: igual que offline-e2e.mjs. Uso: pnpm --filter station e2e:licencia
import { chromium } from 'playwright-core'
import { APP, PASSWORD, USER, createRunner, proxyControl, psql, queueCount, sleep } from './lib.mjs'

const runner = createRunner()
const { step } = runner
const READ_ONLY_TEXT = 'Licencia vencida: solo lectura. Avisa al administrador.'
const QUEUE_TEXT = 'La licencia del sistema está vencida; la operación no se aplicó.'
const SKEW_TEXT = 'El reloj de este equipo está atrasado'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
runner.page = page
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

const expectVisible = (locator, timeout = 8000) => locator.first().waitFor({ state: 'visible', timeout })
const expectHidden = async (locator) => {
  await sleep(800)
  if ((await locator.count()) > 0) throw new Error(`debería estar oculto: ${locator}`)
}
async function goOffline() { await proxyControl('down'); await context.setOffline(true) }
async function goOnline() { await proxyControl('up'); await context.setOffline(false) }

const NOT_LICENSED_QUEUE_TEXT = 'La estación no está habilitada en la licencia; la operación no se aplicó.'
const NOT_LICENSED_LOGIN_TEXT = 'Esta estación no está habilitada en la licencia. Contacta al administrador.'

const openShiftId = () => psql(
  `select es.id from employee_shifts es join employees e on e.id=es."employeeId" join users u on u.id=e."userId" ` +
  `where u.username='${USER}' and es."shiftEndTime" is null order by es."shiftStartTime" desc limit 1`
)

async function measureOffline() {
  await page.goto(`${APP}/tanks`)
  await page.getByRole('button', { name: 'Registrar medición' }).first().click()
  const inputs = page.locator('form input[type=number]')
  await inputs.nth(0).fill('130')
  await inputs.nth(1).fill('5100')
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await expectVisible(page.getByText('Medición guardada'))
}

// Medición y cierre de turno encolados sin red; el proxy rechaza la medición con `code`.
// Debe quedar en conflictos con un solo envío, sin llegar a la BD, y el cierre (detrás) aplicarse.
async function queueRejectCase(code, expectedText) {
  let shiftId = openShiftId()
  if (!shiftId) {
    // Los otros E2E (o el caso anterior) pueden haber cerrado el turno: se abre uno en línea.
    await page.goto(`${APP}/shifts/new`)
    await page.getByRole('button', { name: 'Iniciar turno' }).click()
    await page.waitForURL(/\/shifts\/[0-9a-f-]{36}$/)
    shiftId = page.url().split('/').pop()
  }
  for (const p of ['/tanks', `/shifts/${shiftId}`, '/dashboard']) {
    await page.goto(APP + p)
    await page.waitForLoadState('networkidle')
  }
  const measurementsBefore = Number(psql('select count(*) from tank_measurements'))
  const failedBefore = (await queueCount(page)).failed
  await proxyControl(`reject?op=CreateTankMeasurement&code=${code}`)

  await goOffline()
  await measureOffline()
  await page.goto(`${APP}/shifts/${shiftId}`)
  await page.getByRole('button', { name: 'Cerrar turno' }).click()
  await sleep(1000)
  const queued = await queueCount(page)
  if (queued.queue !== 2) throw new Error('cola esperada 2: ' + JSON.stringify(queued))

  await goOnline()
  let counts
  const t0 = Date.now()
  while (Date.now() - t0 < 30000) {
    counts = await queueCount(page)
    if (counts.queue === 0 && counts.failed === failedBefore + 1) break
    await sleep(500)
  }
  if (counts.queue !== 0 || counts.failed !== failedBefore + 1) {
    throw new Error('estado de la cola: ' + JSON.stringify(counts))
  }
  const rejected = Number(await proxyControl('rejected'))
  if (rejected !== 1) throw new Error(`la medición se envió ${rejected} veces (esperado 1, sin reintentos)`)
  const closed = psql(`select ("shiftEndTime" is not null)::text from employee_shifts where id='${shiftId}'`)
  if (closed !== 'true') throw new Error('el cierre de turno (detrás de la medición) no se aplicó')
  if (Number(psql('select count(*) from tank_measurements')) !== measurementsBefore) {
    throw new Error('la medición rechazada llegó a la BD')
  }
  await page.goto(`${APP}/sync`)
  await expectVisible(page.getByText(expectedText))
  await proxyControl('reject/off')
}

try {
  await step('Login y LEGACY: sin franja de licencia', async () => {
    await page.goto(`${APP}/login`)
    await page.fill('#username', USER)
    await page.fill('#password', PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('**/dashboard')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await expectHidden(page.getByText(/Licencia|La licencia vence/))
  })

  await step('Cola: LICENSE_READ_ONLY va a conflictos sin reintentos y no bloquea el resto', async () => {
    await queueRejectCase('LICENSE_READ_ONLY', QUEUE_TEXT)
  })
  await proxyControl('reject/off')

  await step('DUE_SOON: franja con la fecha de vencimiento', async () => {
    await proxyControl('license?status=DUE_SOON')
    await page.goto(`${APP}/tanks`)
    await expectVisible(page.getByText(/La licencia vence el \d{2}\/\d{2}\/\d{4}/))
    await expectVisible(page.getByRole('button', { name: 'Registrar medición' }))
  })

  await step('GRACE: franja con la fecha de paso a solo lectura', async () => {
    await proxyControl('license?status=GRACE')
    await page.goto(`${APP}/tanks`)
    await expectVisible(page.getByText(/Pasa a solo lectura el \d{2}\/\d{2}\/\d{4}/))
    await expectVisible(page.getByRole('button', { name: 'Registrar medición' }))
  })

  await step('READ_ONLY + reloj atrasado: franja fija y sin acciones de escritura', async () => {
    await proxyControl('license?status=READ_ONLY&skew=1')
    await page.goto(`${APP}/tanks`)
    await expectVisible(page.getByText(READ_ONLY_TEXT))
    await expectVisible(page.getByText(SKEW_TEXT))
    await expectHidden(page.getByRole('button', { name: 'Registrar medición' }))
    await page.goto(`${APP}/shifts/new`)
    await expectVisible(page.getByText(READ_ONLY_TEXT).nth(1))
  })

  await step('READ_ONLY sin red: recarga offline muestra el último estado guardado', async () => {
    await page.goto(`${APP}/tanks`)
    await expectVisible(page.getByText(READ_ONLY_TEXT))
    await proxyControl('license/off')
    await goOffline()
    try {
      await page.reload()
      await expectVisible(page.getByText(READ_ONLY_TEXT))
      await expectHidden(page.getByRole('button', { name: 'Registrar medición' }))
    } finally {
      await goOnline()
    }
  })

  await step('Al reconectar se consulta otra vez: LEGACY quita la franja', async () => {
    await page.goto(`${APP}/tanks`)
    await expectHidden(page.getByText(READ_ONLY_TEXT))
    await expectVisible(page.getByRole('button', { name: 'Registrar medición' }))
  })

  // ── Contrato v2 (T-060) ──────────────────────────────────────────────────
  await step('Prueba gratis en DUE_SOON: avisa que al terminar pasa a solo lectura', async () => {
    await proxyControl('license?status=DUE_SOON&trial=1')
    await page.goto(`${APP}/tanks`)
    await expectVisible(page.getByText(/La prueba gratis termina el \d{2}\/\d{2}\/\d{4}\. Después el sistema pasa a solo lectura\./))
    await expectVisible(page.getByRole('button', { name: 'Registrar medición' }))
    await proxyControl('license/off')
  })

  await step('Cola: STATION_NOT_LICENSED va a conflictos con un solo envío y no bloquea el resto', async () => {
    await queueRejectCase('STATION_NOT_LICENSED', NOT_LICENSED_QUEUE_TEXT)
  })

  await step('Renovación con STATION_NOT_LICENSED: cierra la sesión con el aviso y la cola queda intacta', async () => {
    await page.goto(`${APP}/tanks`)
    await page.waitForLoadState('networkidle')
    await proxyControl('reject?op=RefreshSession&code=STATION_NOT_LICENSED')
    await goOffline()
    await measureOffline()
    const before = await queueCount(page)
    if (before.queue !== 1) throw new Error('cola esperada 1 antes de renovar: ' + JSON.stringify(before))
    // Fuerza la renovación al volver la red: el access token figura como vencido.
    await page.evaluate(() => localStorage.setItem('accessTokenExpiresAt', new Date(Date.now() - 60_000).toISOString()))
    await goOnline()
    await page.waitForURL('**/login', { timeout: 30000 })
    await expectVisible(page.getByText(NOT_LICENSED_LOGIN_TEXT))
    const after = await queueCount(page)
    if (after.queue !== 1) throw new Error('la cola cambió al cerrar la sesión: ' + JSON.stringify(after))
  })

  await step('Login con STATION_NOT_LICENSED: aviso y se queda en /login', async () => {
    await proxyControl('reject?op=Login&code=STATION_NOT_LICENSED')
    await page.goto(`${APP}/login`)
    await page.fill('#username', USER)
    await page.fill('#password', PASSWORD)
    await page.click('button[type=submit]')
    await expectVisible(page.getByText(NOT_LICENSED_LOGIN_TEXT))
    await sleep(800)
    if (!page.url().includes('/login')) throw new Error('no se quedó en /login: ' + page.url())
  })
} finally {
  await proxyControl('reject/off').catch(() => {})
  await proxyControl('license/off').catch(() => {})
  await proxyControl('up').catch(() => {})
  await context.close().catch(() => {})
  await browser.close()
}

process.exitCode = runner.finish()
