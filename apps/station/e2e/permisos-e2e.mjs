// E2E de station en navegador (T-044, ADR-016): cada cargo ve solo lo que puede hacer, y una
// operación encolada offline que el servidor rechaza con FORBIDDEN va directo a /sync.
//
// Casos:
//   1. Cajero (control positivo): ve "Registrar pago" en un ticket despachado.
//   2. Bombero: en ese mismo ticket no ve "Registrar pago" ni "Cancelar ticket".
//   3. Cajero offline: abre turno sin red; mientras la operación está encolada, su cargo cambia
//      en la BD a uno sin permiso para abrir turnos; al reconectar, la operación va a conflictos
//      con el mensaje de permiso, sin consumir reintentos.
//
// Requisitos: igual que offline-e2e.mjs (stack de verificación, station en E2E_APP, proxy).
// Uso: pnpm --filter station e2e:permisos
import { chromium } from 'playwright-core'
import { APP, PASSWORD, createRunner, proxyControl, psql, queueCount, sleep } from './lib.mjs'

const runner = createRunner()
const { step } = runner
const CASHIER = 'cajero.norte'
const BOMBERO = 'bombero1.norte'
const FORBIDDEN_TEXT = 'Tu usuario no tiene permiso para esta operación.'

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
  await page.waitForURL('**/dashboard')
}

const expectVisible = (locator, timeout = 8000) => locator.first().waitFor({ state: 'visible', timeout })
const expectHidden = async (locator) => {
  await sleep(800)
  if ((await locator.count()) > 0) throw new Error(`debería estar oculto: ${locator}`)
}

const setUserType = (username, userType) =>
  psql(`update users set "userType"='${userType}' where username='${username}'`)

// Un ticket POSTPAID de Norte no cancelado, puesto en DISPATCHED para el caso (el cobro sería
// posible para el cajero). Se restaura su estado original al final.
const [ticketId, originalStatus] = psql(
  `select st.id||'|'||st.status from sales_tickets st join users u on u."gasStationId"=st."gasStationId" ` +
  `where u.username='${BOMBERO}' and st."paymentMode"='POSTPAID' and st.status<>'CANCELED' limit 1`
).split('|')
if (!ticketId) throw new Error('el seed no tiene un ticket POSTPAID en Norte')

try {
  psql(`update sales_tickets set status='DISPATCHED' where id='${ticketId}'`)

  await step('Cajero (control): ve "Registrar pago" en el ticket despachado', async () => {
    const { page } = await newPage()
    await login(page, CASHIER)
    await page.goto(`${APP}/tickets/${ticketId}`)
    await expectVisible(page.getByRole('button', { name: 'Registrar pago' }))
  })

  await step('Bombero: en el mismo ticket no ve "Registrar pago" ni "Cancelar ticket" (T-044)', async () => {
    const { page } = await newPage()
    await login(page, BOMBERO)
    await page.goto(`${APP}/tickets/${ticketId}`)
    await expectVisible(page.getByText(/Ticket #/))
    await expectHidden(page.getByRole('button', { name: 'Registrar pago' }))
    await expectHidden(page.getByRole('button', { name: 'Cancelar ticket' }))
  })

  await step('Cajero offline: cerrar su turno encolado; cambio de cargo → FORBIDDEN va a conflictos', async () => {
    const shiftId = psql(
      `select es.id from employee_shifts es join employees e on e.id=es."employeeId" ` +
      `join users u on u.id=e."userId" where u.username='${CASHIER}' and es."shiftEndTime" is null limit 1`
    )
    if (!shiftId) throw new Error(`${CASHIER} no tiene turno abierto en el seed`)

    const { context, page } = await newPage()
    await login(page, CASHIER)
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    for (const p of [`/shifts/${shiftId}`, '/shifts', '/dashboard']) {
      await page.goto(APP + p)
      await page.waitForLoadState('networkidle')
    }

    await proxyControl('down')
    await context.setOffline(true)
    try {
      await page.goto(`${APP}/shifts/${shiftId}`)
      await page.getByRole('button', { name: 'Cerrar turno' }).click()
      await sleep(1000)
      const queued = await queueCount(page)
      if (queued.queue !== 1) throw new Error('la operación no quedó en la cola: ' + JSON.stringify(queued))

      setUserType(CASHIER, 'Administrative')
    } finally {
      await proxyControl('up')
      await context.setOffline(false)
    }

    const t0 = Date.now()
    let counts
    while (Date.now() - t0 < 30000) {
      counts = await queueCount(page)
      if (counts.queue === 0 && counts.failed === 1) break
      await sleep(500)
    }
    if (!counts || counts.queue !== 0 || counts.failed !== 1) {
      throw new Error('la operación no pasó a conflictos: ' + JSON.stringify(counts))
    }

    await page.goto(`${APP}/sync`)
    await expectVisible(page.getByText('Finalizar turno').first())
    await expectVisible(page.getByText(FORBIDDEN_TEXT))
  })
} finally {
  setUserType(CASHIER, 'Cashier')
  psql(`update sales_tickets set status='${originalStatus}' where id='${ticketId}'`)
  for (const c of contexts) await c.close().catch(() => {})
  await browser.close()
}

process.exitCode = runner.finish()
