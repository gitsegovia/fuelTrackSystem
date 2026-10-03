// E2E de station en navegador (T-030, fase A): flujo offline completo (T-004/T-007/T-013),
// recarga offline, reconexión y sincronización, error de negocio en /sync, cobro con pago previo
// en otra moneda, reporte de turno y /tanks (T-017).
//
// Requisitos: stack de verificación arriba (docker compose -f docker-compose.verify.yml
// -p ft-station-e2e up -d --build), station servido en E2E_APP (build apuntando al proxy) y el
// proxy cortable en E2E_PROXY_CONTROL. Chrome instalado (channel 'chrome').
// Uso: pnpm --filter station e2e
import { chromium } from 'playwright-core'
import {
  APP, PASSWORD, USER, createRunner, parseMoney, proxyControl, psql, queueCount, sleep,
} from './lib.mjs'

const runner = createRunner()
const { step } = runner
let page, context

const expectVisible = (locator, timeout = 8000) => locator.first().waitFor({ state: 'visible', timeout })
async function goOffline() { await proxyControl('down'); await context.setOffline(true) }
async function goOnline() { await proxyControl('up'); await context.setOffline(false) }

async function waitQueueEmpty(timeout = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const s = await queueCount(page)
    if (s.queue === 0) return s
    await page.waitForTimeout(500)
  }
  throw new Error('la cola no se vació: ' + JSON.stringify(await queueCount(page)))
}

async function selectFirstReal(select) {
  const values = await select.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean))
  if (!values.length) throw new Error('select sin opciones')
  await select.selectOption(values[0])
  return values
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
page = await context.newPage()
runner.page = page
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

let shiftLocalId, ticketTotalStr, ticketCurrencySymbol, nozzleCount = 0, employeeId

await step('Login online y SW activo', async () => {
  await page.goto(`${APP}/login`)
  await page.fill('#username', USER)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
})

await step('Calentar cache online (listas, catálogos)', async () => {
  // Cada page.goto() recrea el ApolloClient y restaura desde localStorage; el debounce de
  // persistCache (2 s) hace que un goto inmediato pierda lo recién cacheado. Se espera tras
  // cada navegación. dispensersByGasStation solo se pide desde detalle de ticket o lecturas:
  // se calienta visitando un ticket existente del seed para la misma estación.
  const anyTicket = psql(
    `select st.id from sales_tickets st join employees e on e."gasStationId"=st."gasStationId" ` +
    `join users u on u.id=e."userId" where u.username='${USER}' limit 1`
  )
  const routes = ['/shifts', '/shifts/new', '/tanks', '/tickets', ...(anyTicket ? [`/tickets/${anyTicket}`] : [])]
  for (const p of [...routes, '/tickets/new?shiftId=warmup', '/dashboard']) {
    await page.goto(APP + p)
    await page.waitForLoadState('networkidle')
  }
})

// ── Offline (paso 1 del guion) ──────────────────────────────────────────────
await goOffline()

await step('Recarga offline conserva la sesión (H-024)', async () => {
  await page.reload()
  if (page.url().includes('/login')) throw new Error('mandó a /login')
  const token = await page.evaluate(() => localStorage.getItem('accessToken'))
  if (!token) throw new Error('borró el token')
})

await step('Abrir turno offline → /shifts/:localId muestra empleado y botón Cerrar (H-023)', async () => {
  await page.goto(`${APP}/shifts/new`)
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await page.waitForURL(/\/shifts\/[0-9a-f-]{36}$/)
  shiftLocalId = page.url().split('/').pop()
  await expectVisible(page.getByRole('button', { name: 'Cerrar turno' }))
})

await step('Lecturas INITIAL offline: lista boquillas operativas', async () => {
  await page.getByRole('button', { name: 'Lecturas iniciales' }).click()
  const inputs = page.locator('input[type=number]')
  await expectVisible(inputs)
  nozzleCount = await inputs.count()
  if (nozzleCount === 0) throw new Error('sin boquillas')
  for (let i = 0; i < nozzleCount; i++) await inputs.nth(i).fill(String(1000 + i))
  await page.getByRole('button', { name: /Guardar offline/ }).click()
  await page.waitForURL(`**/shifts/${shiftLocalId}`)
  await expectVisible(page.getByRole('button', { name: 'Lecturas finales' }))
})

await step('Ticket offline: se crea y abre el detalle (H-023)', async () => {
  await page.getByRole('button', { name: 'Nuevo ticket' }).click()
  const [fuel, config] = [page.locator('select').nth(0), page.locator('select').nth(1)]
  const fuels = await fuel.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean))
  let ok = false
  for (const f of fuels) {
    await fuel.selectOption(f)
    if ((await config.locator('option').count()) > 1) { await selectFirstReal(config); ok = true; break }
  }
  if (!ok) throw new Error('ningún combustible con configuración de venta')
  await page.locator('input[type=number]').fill('10')
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/)
  await expectVisible(page.getByRole('button', { name: 'Registrar despacho' }))
})

await step('Despacho offline: refleja el despacho y no ofrece repetirlo', async () => {
  await page.getByRole('button', { name: 'Registrar despacho' }).click()
  const selects = page.locator('form select')
  await selectFirstReal(selects.nth(0))
  await selectFirstReal(selects.nth(1))
  await page.locator('form input[type=number]').fill('10')
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await expectVisible(page.getByText('Litros despachados'))
  await expectVisible(page.getByText('Pagado — pendiente de despacho'))
  if (await page.getByRole('button', { name: 'Registrar despacho' }).count()) throw new Error('sigue ofreciendo despachar')
  // "Total a cobrar" está en el resumen superior, siempre visible.
  const totalText = await page.getByText('Total a cobrar').locator('xpath=following-sibling::span').first().textContent()
  ticketTotalStr = totalText ?? ''
  ticketCurrencySymbol = ticketTotalStr.trim().split(/\s/)[0]
})

// ── T-017: cobro con un pago previo en otra moneda ──────────────────────────
await step('Cobro — pago 1: parcial, en una moneda distinta a la del ticket', async () => {
  await page.getByRole('button', { name: 'Registrar pago' }).click()
  const currencySelect = page.locator('select[name="lines.0.currencyId"]')
  const options = await currencySelect.locator('option').evaluateAll((os) =>
    os.map((o) => ({ value: o.value, text: o.textContent })).filter((o) => o.value)
  )
  const other = options.find((o) => !o.text.startsWith(ticketCurrencySymbol)) ?? options[0]
  await currencySelect.selectOption(other.value)
  // El monto sugerido (amber junto a "Moneda") es el pendiente convertido a esta moneda.
  // Acotado a la card de pago: .text-amber-600 también existe en el formulario de despacho.
  const paymentCard = page.locator('[data-slot="card"]').filter({ hasText: 'Registrar pago' }).last()
  const suggested = paymentCard.locator('.text-amber-600').first()
  await expectVisible(suggested)
  const suggestedRaw = (await suggested.textContent()) ?? ''
  const suggestedAmount = parseMoney(suggestedRaw)
  const firstPaymentAmount = +(suggestedAmount * 0.4).toFixed(2)
  if (!Number.isFinite(firstPaymentAmount) || firstPaymentAmount <= 0) {
    throw new Error(`monto sugerido inválido: texto="${suggestedRaw}" monto=${firstPaymentAmount}`)
  }
  await page.locator('input[name="lines.0.amount"]').fill(String(firstPaymentAmount))
  await page.getByRole('button', { name: 'Guardar pago offline' }).click()
  await expectVisible(page.getByText('Pagos registrados'))
})

await step('Cobro — el resumen del pago 2 descuenta el pago 1 (H-025 #2)', async () => {
  await page.getByRole('button', { name: 'Registrar pago' }).click()
  const pendingLabel = page.getByText('Pendiente antes de este pago')
  await expectVisible(pendingLabel)
  const pendingText = await pendingLabel.locator('xpath=following-sibling::span').first().textContent()
  const pending = parseMoney(pendingText ?? '')
  const total = parseMoney(ticketTotalStr)
  // El pago 1 fue el 40% del total → debía quedar ~60% pendiente (antes del fix, el resumen
  // comparaba contra el total completo y no descontaba nada).
  const expected = total * 0.6
  const tolerance = total * 0.03
  if (!(pending < total) || Math.abs(pending - expected) > tolerance) {
    throw new Error(`"Pendiente antes de este pago" = ${pendingText} (${pending}); esperado ≈ ${expected.toFixed(2)}`)
  }
  const currencySelect = page.locator('select[name="lines.0.currencyId"]')
  const options = await currencySelect.locator('option').evaluateAll((os) =>
    os.map((o) => ({ value: o.value, text: o.textContent })).filter((o) => o.value)
  )
  await currencySelect.selectOption(options.find((o) => o.text.startsWith(ticketCurrencySymbol)).value)
  await page.locator('input[name="lines.0.amount"]').fill(String((pending * 1.02).toFixed(2)))
  await expectVisible(page.getByText('✓ Pago cubierto'))
  await page.getByRole('button', { name: 'Guardar pago offline' }).click()
  await expectVisible(page.getByText('Completado'))
})

await step('Lecturas FINAL offline', async () => {
  await page.goto(`${APP}/shifts/${shiftLocalId}`)
  await page.getByRole('button', { name: 'Lecturas finales' }).click()
  const inputs = page.locator('input[type=number]')
  await expectVisible(inputs)
  const n = await inputs.count()
  for (let i = 0; i < n; i++) await inputs.nth(i).fill(String(1010 + i))
  await page.getByRole('button', { name: /Guardar offline/ }).click()
  await page.waitForURL(`**/shifts/${shiftLocalId}`)
  await expectVisible(page.getByText('✓ Completas'))
})

await step('Medición de tanque offline (turno local)', async () => {
  await page.goto(`${APP}/tanks`)
  await page.getByRole('button', { name: 'Registrar medición' }).first().click()
  const inputs = page.locator('form input[type=number]')
  await inputs.nth(0).fill('120')
  await inputs.nth(1).fill('5000')
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await expectVisible(page.getByText('Medición guardada').first()) // la cola escribió antes de navegar
})

// Criterio T-035: la última escritura sobrevive a una recarga dentro de 1 s. Tras "Cerrar turno"
// se navega (recarga completa) en cuanto la app vuelve a /shifts; el flush en pagehide debe
// haber guardado la escritura, así que el dashboard tiene que mostrar "Sin turno activo".
await step('Cerrar turno offline: recarga < 1 s conserva la escritura (flush pagehide)', async () => {
  await page.goto(`${APP}/shifts/${shiftLocalId}`)
  await page.getByRole('button', { name: 'Cerrar turno' }).click()
  const tWrite = Date.now()
  await page.waitForURL('**/shifts')
  const gap = Date.now() - tWrite
  console.log(`  recarga a ${gap} ms de la escritura`)
  if (gap >= 1000) throw new Error(`la navegación tardó ${gap} ms (el criterio exige < 1 s)`)
  await page.goto(`${APP}/dashboard`)
  await expectVisible(page.getByText('Sin turno activo'))
})

await step('Todo quedó en la cola (sin conflictos)', async () => {
  const q = await queueCount(page)
  // 1 turno + N lecturas INITIAL + 1 ticket + 1 despacho + 2 pagos + N lecturas FINAL + 1 medición + 1 cierre
  const expected = 1 + nozzleCount + 1 + 1 + 2 + nozzleCount + 1 + 1
  if (q.queue !== expected || q.failed !== 0) throw new Error(`cola ${JSON.stringify(q)}, esperado ${expected}`)
})

// ── Reconexión (paso 3 del guion) ───────────────────────────────────────────
await step('Al abrir la app con red sincroniza sin otro evento', async () => {
  await page.close()
  await goOnline()
  page = await context.newPage()
  runner.page = page
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
  await page.goto(`${APP}/dashboard`)
  const s = await waitQueueEmpty(45000)
  if (s.failed !== 0) throw new Error('conflictos: ' + s.failed)
})

await step('BD: turno, lecturas, ticket, 2 pagos y medición con IDs reales, sin duplicados', async () => {
  employeeId = psql(`select e.id from employees e join users u on u.id=e."userId" where u.username='${USER}'`)
  // (… is not null) concatenado con || se castea a 'true'/'false'.
  const [shiftId, closed] = psql(
    `select id||'|'||("shiftEndTime" is not null) from employee_shifts where "employeeId"='${employeeId}' order by "createdAt" desc limit 1`
  ).split('|')
  if (closed !== 'true') throw new Error('turno no cerrado')
  const readings = Number(psql(`select count(*) from dispenser_readings where "employeeShiftId"='${shiftId}'`))
  if (readings !== nozzleCount * 2) throw new Error(`lecturas ${readings}, esperado ${nozzleCount * 2}`)
  const [ticketId, status, liters] = psql(
    `select id||'|'||status||'|'||coalesce("actualLitersDispatched"::text,'null') from sales_tickets where "cashierShiftId"='${shiftId}'`
  ).split('|')
  if (status !== 'COMPLETED' || Number(liters) !== 10) throw new Error(`ticket ${status} ${liters}`)
  if (psql(`select count(*) from payments where "salesTicketId"='${ticketId}'`) !== '2') throw new Error('pagos != 2')
  if (psql(`select count(*) from tank_measurements where "employeeShiftId"='${shiftId}'`) !== '1') throw new Error('medición no ligada al turno')
  if (psql(`select count(*) from employee_shifts where "employeeId"='${employeeId}' and "createdAt" > now() - interval '1 hour'`) !== '1') {
    throw new Error('turnos duplicados')
  }
})

// ── Reporte de turno: las filas suman el Total (T-017) ──────────────────────
await step('Reporte de turno: filas por bombero/boquilla suman el Total (H-025 #3)', async () => {
  const closedShiftId = psql(`select id from employee_shifts where "employeeId"='${employeeId}' order by "createdAt" desc limit 1`)
  await page.goto(`${APP}/shifts/${closedShiftId}/report`)
  await expectVisible(page.getByText('Litros despachados (tickets)'))
  const totalLiters = parseMoney(
    (await page.getByText('Litros despachados (tickets)').locator('xpath=following-sibling::span').first().textContent()) ?? ''
  )
  // Acotado al Card de "Despacho por boquilla": "Total" también aparece en otras tablas.
  const nozzleTotalRow = page.locator('[data-slot="card"]').filter({ hasText: 'Despacho por boquilla' }).locator('div.font-semibold').last()
  await expectVisible(nozzleTotalRow)
  const nozzleTotal = parseMoney((await nozzleTotalRow.locator('span').last().textContent()) ?? '')
  if (Math.abs(nozzleTotal - totalLiters) > 0.01) throw new Error(`Total por boquilla ${nozzleTotal} ≠ ${totalLiters}`)
})

// ── /tanks: última medición (T-017, latestTankMeasurement) ──────────────────
await step('/tanks muestra la última medición (latestTankMeasurement, H-025 #6)', async () => {
  await page.goto(`${APP}/tanks`)
  await page.waitForLoadState('networkidle')
  await expectVisible(page.getByText('Última medición'))
  const dateEls = await page.getByText('Última medición').locator('xpath=following-sibling::p[1]').allTextContents()
  const d = new Date()
  const stamp = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  if (!dateEls.some((t) => t.includes(stamp))) throw new Error(`ninguna tarjeta muestra hoy (${stamp}): ${JSON.stringify(dateEls)}`)
})

// ── Error de negocio → /sync (paso 4) ───────────────────────────────────────
await step('Error de negocio → queda en /sync con el error; Descartar funciona', async () => {
  const target = psql(
    `select id from sales_tickets where status='PENDING_PAYMENT_DISPATCH' and "gasStationId"=(select "gasStationId" from employees where id='${employeeId}') limit 1`
  )
  if (!target) throw new Error('no hay ticket pendiente en el seed')
  await page.goto(`${APP}/tickets/${target}`)
  await expectVisible(page.getByRole('button', { name: 'Registrar despacho' }))
  await goOffline()
  await page.getByRole('button', { name: 'Registrar despacho' }).click()
  const selects = page.locator('form select')
  await selectFirstReal(selects.nth(0))
  await selectFirstReal(selects.nth(1))
  await page.locator('form input[type=number]').fill('5')
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await expectVisible(page.getByText('Despacho guardado offline').first())
  // Cambio en el servidor mientras el despacho está encolado: el sync lo recibirá como error de negocio.
  psql(`update sales_tickets set status='CANCELED' where id='${target}'`)
  await goOnline()
  await page.goto(`${APP}/sync`)
  for (let i = 0; i < 6 && (await queueCount(page)).failed === 0; i++) {
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click().catch(() => {})
    await page.waitForTimeout(1500)
  }
  await expectVisible(page.getByText('Con error (1)'))
  await page.getByRole('button', { name: 'Descartar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click()
  await expectVisible(page.getByText('Todo está sincronizado.'))
})

await step('Token inválido con red → cierra la sesión', async () => {
  await page.evaluate(() => localStorage.setItem('accessToken', 'token-invalido'))
  await page.reload()
  await page.waitForURL('**/login', { timeout: 10000 })
  const token = await page.evaluate(() => localStorage.getItem('accessToken'))
  if (token) throw new Error('no borró el token')
})

await browser.close()
process.exit(runner.finish())
