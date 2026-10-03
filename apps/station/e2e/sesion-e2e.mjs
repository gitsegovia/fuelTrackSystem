// E2E de station en navegador (T-030, fase B / T-010, ADR-014): sesión con refresh rotativo.
//   1. Se opera online más de 2 min sin re-login y se ven renovaciones de sesión (refreshSession).
//   2. Offline se encola una medición de tanque y se espera a que venza la sesión.
//   3. Al volver la red, el refresh devuelve SESSION_EXPIRED → login con aviso, cola intacta.
//   4. Re-login → la cola se envía y la medición llega a la BD.
//
// Requiere el stack de verificación levantado con sesión corta:
//   ACCESS_TOKEN_MINUTES=1 SESSION_MAX_HOURS=0.05 docker compose -f docker-compose.verify.yml \
//     -p ft-station-e2e up -d --build
// Uso: pnpm --filter station e2e:sesion
import { chromium } from 'playwright-core'
import { APP, PASSWORD, USER, createRunner, proxyControl, psql, queueCount, sleep } from './lib.mjs'

const runner = createRunner()
const { step } = runner
const SESSION_MS = Number(process.env.E2E_SESSION_MS ?? 200_000) // > SESSION_MAX_HOURS=0.05 (180 s)
const ONLINE_MS = Number(process.env.E2E_ONLINE_MS ?? 90_000)  // > 2 min de operación en total

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
runner.page = page
let refreshCount = 0
context.on('request', (r) => {
  if (r.method() === 'POST' && (r.postData() ?? '').includes('RefreshSession')) refreshCount++
})

const t0 = Date.now()
await step('Login online', async () => {
  await page.goto(`${APP}/login`)
  await page.fill('#username', USER)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard')
})

await step('Operar > 2 min sin re-login y ver renovaciones de sesión (T-010 criterio 1)', async () => {
  while (Date.now() - t0 < ONLINE_MS) {
    await sleep(10_000)
    if (page.url().includes('/login')) throw new Error('mandó a /login antes de tiempo')
  }
  await page.goto(`${APP}/tanks`)
  await page.waitForLoadState('networkidle')
  if (refreshCount < 2) throw new Error(`refreshSession solo ${refreshCount} veces (esperadas ≥ 2)`)
})

const measurementsBefore = Number(psql(`select count(*) from tank_measurements`))

await step('Offline: medición de tanque encolada', async () => {
  proxyControl('down')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Registrar medición' }).first().click()
  const inputs = page.locator('form input[type=number]')
  await inputs.nth(0).fill('111')
  await inputs.nth(1).fill('4444')
  await page.getByRole('button', { name: 'Guardar offline' }).click()
  await sleep(1000)
  const q = await queueCount(page)
  if (q.queue !== 1) throw new Error(`cola = ${q.queue}, esperada 1`)
})

await step('Esperar que venza la sesión sin red', async () => {
  const remaining = SESSION_MS - (Date.now() - t0)
  if (remaining > 0) await sleep(remaining)
})

await step('Al volver la red: sesión vencida → login con aviso, cola intacta (T-010 criterio 2)', async () => {
  proxyControl('up')
  await context.setOffline(false)
  await page.waitForURL('**/login', { timeout: 60_000 })
  await page.getByText('Tu sesión venció').first().waitFor({ state: 'visible', timeout: 15_000 })
  const q = await queueCount(page)
  if (q.queue !== 1) throw new Error(`cola tras vencer la sesión = ${q.queue}, esperada 1`)
  if (await page.evaluate(() => localStorage.getItem('accessToken'))) throw new Error('quedó accessToken')
})

await step('Re-login → la cola se envía sola y la medición llega a la BD', async () => {
  await page.fill('#username', USER)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard')
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline && (await queueCount(page)).queue > 0) await sleep(500)
  if ((await queueCount(page)).queue > 0) throw new Error('la cola no se vació tras re-login')
  const after = Number(psql(`select count(*) from tank_measurements`))
  if (after !== measurementsBefore + 1) throw new Error(`mediciones en BD ${after}, esperado ${measurementsBefore + 1}`)
})

await browser.close()
process.exit(runner.finish())
