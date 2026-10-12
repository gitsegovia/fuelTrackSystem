// E2E de station en navegador (T-057, D-19): estación desactivada por la API.
// Usa la Estación Sur para no tocar los datos de Norte que usan los otros scripts; al final la
// vuelve a dejar activa (por SQL: la API no tiene mutation de reactivación, ver T-055).
//
// Casos:
//   1. bombero1.sur encola una medición sin red.
//   2. El admin desactiva Sur con deactivateGasStation (antes se cierran por SQL sus turnos y
//      tickets abiertos, que la API exige para desactivar).
//   3. Al reconectar, la medición vuelve con STATION_INACTIVE → conflictos con un solo envío.
//   4. Renovación con STATION_INACTIVE: la sesión se cierra con el aviso y la cola queda intacta.
//   5. cajero.sur intenta entrar y ve el aviso de estación desactivada.
//
// Requisitos: igual que offline-e2e.mjs. Uso: pnpm --filter station e2e:estacion
import { chromium } from 'playwright-core'
import { APP, PASSWORD, createRunner, proxyControl, psql, queueCount, sleep } from './lib.mjs'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4500/graphql'
const BOMBERO = 'bombero1.sur'
const CASHIER = 'cajero.sur'
const ADMIN = 'admin.petronorte'
const LOGIN_TEXT = 'Tu estación está desactivada. Contacta al administrador.'
const QUEUE_TEXT = 'La estación fue desactivada; la operación no se aplicó.'

const runner = createRunner()
const { step } = runner
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const contexts = []

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  contexts.push(context)
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
  runner.page = page
  return { context, page }
}

async function login(page, username) {
  await page.goto(`${APP}/login`)
  await page.fill('#username', username)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
}

async function api(query, variables, token) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

async function measureOffline(page) {
  await page.goto(`${APP}/tanks`)
  await page.getByRole('button', { name: 'Registrar medición' }).first().click()
  const inputs = page.locator('form input[type=number]')
  await inputs.nth(0).fill('110')
  await inputs.nth(1).fill('4800')
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await page.getByText('Medición guardada').first().waitFor({ state: 'visible', timeout: 8000 })
}

const expectVisible = (locator, timeout = 8000) => locator.first().waitFor({ state: 'visible', timeout })
const surId = psql(`select "gasStationId" from users where username='${BOMBERO}'`)
if (!surId) throw new Error(`${BOMBERO} no tiene estación en el seed`)

try {
  const { context, page } = await newPage()
  const goOffline = async () => { await proxyControl('down'); await context.setOffline(true) }
  const goOnline = async () => { await proxyControl('up'); await context.setOffline(false) }
  let measurementsBefore

  await step('Sur activa: el bombero encola una medición sin red', async () => {
    await login(page, BOMBERO)
    await page.waitForURL('**/dashboard')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    for (const p of ['/tanks', '/dashboard']) {
      await page.goto(APP + p)
      await page.waitForLoadState('networkidle')
    }
    measurementsBefore = Number(psql(`select count(*) from tank_measurements`))
    await proxyControl('count?op=CreateTankMeasurement')
    await goOffline()
    await measureOffline(page)
    const q = await queueCount(page)
    if (q.queue !== 1) throw new Error('cola esperada 1: ' + JSON.stringify(q))
  })

  await step('El admin desactiva Sur con deactivateGasStation', async () => {
    psql(`update employee_shifts set "shiftEndTime"=now() where "gasStationId"='${surId}' and "shiftEndTime" is null`)
    psql(`update sales_tickets set status='CANCELED' where "gasStationId"='${surId}' and status not in ('COMPLETED','CANCELED')`)
    const { login: auth } = await api(
      'mutation($i: LoginInput!){ login(input:$i){ token } }',
      { i: { username: ADMIN, password: PASSWORD } }
    )
    const { deactivateGasStation } = await api(
      'mutation($id: UUID!){ deactivateGasStation(id:$id){ id active } }',
      { id: surId },
      auth.token
    )
    if (deactivateGasStation.active !== false) throw new Error('la estación sigue activa')
  })

  await step('Al reconectar: STATION_INACTIVE → conflictos con un solo envío', async () => {
    await goOnline()
    let counts
    const t0 = Date.now()
    while (Date.now() - t0 < 30000) {
      counts = await queueCount(page)
      if (counts.queue === 0 && counts.failed === 1) break
      await sleep(500)
    }
    if (counts.queue !== 0 || counts.failed !== 1) throw new Error('estado de la cola: ' + JSON.stringify(counts))
    const sent = Number(await proxyControl('counted'))
    if (sent !== 1) throw new Error(`la medición se envió ${sent} veces (esperado 1, sin reintentos)`)
    if (Number(psql('select count(*) from tank_measurements')) !== measurementsBefore) {
      throw new Error('la medición llegó a la BD')
    }
    await page.goto(`${APP}/sync`)
    await expectVisible(page.getByText(QUEUE_TEXT))
  })

  await step('Renovación con STATION_INACTIVE: cierra la sesión con el aviso y la cola queda intacta', async () => {
    await goOffline()
    await measureOffline(page)
    const before = await queueCount(page)
    if (before.queue !== 1) throw new Error('cola esperada 1 antes de renovar: ' + JSON.stringify(before))
    // Fuerza la renovación al volver la red: el access token figura como vencido.
    await page.evaluate(() => localStorage.setItem('accessTokenExpiresAt', new Date(Date.now() - 60_000).toISOString()))
    await goOnline()
    await page.waitForURL('**/login', { timeout: 30000 })
    await expectVisible(page.getByText(LOGIN_TEXT))
    const after = await queueCount(page)
    if (after.queue !== 1) throw new Error('la cola cambió al cerrar la sesión: ' + JSON.stringify(after))
  })

  await step('Login del cajero de Sur: aviso de estación desactivada', async () => {
    const { page: p2 } = await newPage()
    await login(p2, CASHIER)
    await expectVisible(p2.getByText(LOGIN_TEXT))
    if (!p2.url().includes('/login')) throw new Error('no se quedó en /login: ' + p2.url())
  })
} finally {
  psql(`update gas_stations set active=true where id='${surId}'`)
  await proxyControl('count/off').catch(() => {})
  await proxyControl('up').catch(() => {})
  for (const c of contexts) await c.close().catch(() => {})
  await browser.close()
}

process.exitCode = runner.finish()
