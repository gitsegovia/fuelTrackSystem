// Helpers compartidos de los E2E de station (T-030). Requieren el stack de verificación
// (docker-compose.verify.yml, proyecto ft-station-e2e), station en vite preview y el proxy
// cortable que apunta la API. Ver e2e/README-equivalente en la cabecera de cada script.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const APP = process.env.E2E_APP ?? 'http://localhost:3001'
export const PROXY_CONTROL = process.env.E2E_PROXY_CONTROL ?? 'http://localhost:4502'
const DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? 'ft-station-e2e-verify-db-1'
// Gerente de Norte: la matriz de ADR-016 le permite todo lo de la operación de estación (filas
// 6–14), así que sirve para los flujos de punta a punta. Los casos por cargo van en permisos-e2e.mjs.
export const USER = 'mgr.norte'
export const SHOTS = join(tmpdir(), 'ft-station-e2e')
mkdirSync(SHOTS, { recursive: true })

const here = dirname(fileURLToPath(import.meta.url))
const seedPath = join(here, '../../api/sequelize/seeders/20250709033908-initial-data.cjs')
export const PASSWORD = readFileSync(seedPath, 'utf8').match(/hashSync\('([^']+)'/)[1]

export const psql = (sql) =>
  execFileSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', 'verify', '-d', 'fueltrack_verify', '-t', '-A', '-c', sql],
    { encoding: 'utf8' }
  ).trim()

export const proxyControl = async (state) => (await fetch(`${PROXY_CONTROL}/${state}`)).text()

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Monto formateado por toLocaleString(undefined, …): depende del locale del Chrome. El separador
// decimal es el que aparece más a la derecha; el otro (si aparece) es de miles.
export function parseMoney(text) {
  const cleaned = text.replace(/[^\d.,-]/g, '')
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized
  if (lastComma > lastDot) normalized = cleaned.replace(/\./g, '').replace(',', '.')
  else if (lastDot > lastComma) normalized = cleaned.replace(/,/g, '')
  else normalized = cleaned
  return parseFloat(normalized)
}

export function createRunner() {
  const results = []
  const runner = {
    results,
    page: null,
    async step(name, fn) {
      try {
        await fn()
        results.push(['PASS', name])
        console.log('PASS', name)
      } catch (e) {
        results.push(['FAIL', name, e.message.split('\n')[0]])
        console.log('FAIL', name, '—', e.message.split('\n')[0])
        try {
          await runner.page?.screenshot({ path: join(SHOTS, `fail-${results.length}.png`), fullPage: true })
        } catch {}
      }
    },
    finish() {
      const failed = results.filter((r) => r[0] === 'FAIL')
      console.log(`\n${results.length - failed.length}/${results.length} pasos OK`)
      console.log(`capturas de fallo en ${SHOTS}`)
      return failed.length ? 1 : 0
    },
  }
  return runner
}

export async function queueCount(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('fueltrack-offline')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const count = (s) =>
      new Promise((res) => {
        const r = db.transaction(s).objectStore(s).count()
        r.onsuccess = () => res(r.result)
      })
    const out = { queue: await count('mutation-queue'), failed: await count('failed-mutations') }
    db.close()
    return out
  })
}
