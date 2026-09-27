// IndexedDB wrapper para la cola de mutations offline
// Sin dependencias externas — usa la API nativa del browser

const DB_NAME = 'fueltrack-offline'
const QUEUE_STORE = 'mutation-queue'
const FAILED_STORE = 'failed-mutations'
const ID_MAP_STORE = 'id-map'
// v1: mutation-queue · v2: + failed-mutations, id-map (los items de v1 se conservan)
const DB_VERSION = 2

export interface QueuedMutation {
  id: string
  operationName: string
  query: string          // documento GQL serializado con print()
  variables: Record<string, unknown>
  timestamp: number
  retries: number
  localId?: string       // UUID temporal generado offline (para reconciliación de IDs)
  dependsOn?: string     // localId del que depende (para ordenar y remap en sync)
  createdBy?: string     // username del usuario que generó la mutation
  deviceFingerprint?: string  // ID estable del navegador/dispositivo (localStorage)
  lastError?: string
}

export interface FailedMutation extends QueuedMutation {
  lastError: string
  failedAt: number
}

interface IdMapping {
  localId: string
  realId: string
  createdAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
    req.onblocked = () => {
      console.warn('[FuelTrack] Actualización de IndexedDB bloqueada: cierra las otras pestañas de FuelTrack.')
    }
    req.onsuccess = () => {
      const db = req.result
      // Otra pestaña con una versión más nueva necesita actualizar: soltar la conexión.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FAILED_STORE)) {
        db.createObjectStore(FAILED_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(ID_MAP_STORE)) {
        db.createObjectStore(ID_MAP_STORE, { keyPath: 'localId' })
      }
    }
  })
  return dbPromise
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function transactionDone(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB()
  return db.transaction(name, mode).objectStore(name)
}

const byTimestamp = <T extends { timestamp: number }>(a: T, b: T) => a.timestamp - b.timestamp

// ── Cola ──────────────────────────────────────────────────────────────────────

/**
 * `id` viaja como header `x-offline-mutation-id` en cada envío (dedupe server-side).
 * Pasar el id con el que ya se intentó enviar la operación; si se omite, se genera uno.
 */
let lastTimestamp = 0

export async function enqueue(
  mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'> & { id?: string }
): Promise<string> {
  // Estrictamente creciente: dos operaciones en el mismo ms (ej. create + su dependiente)
  // deben sincronizarse en el orden en que se encolaron.
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1)
  const entry: QueuedMutation = {
    ...mutation,
    id: mutation.id ?? crypto.randomUUID(),
    timestamp: lastTimestamp,
    retries: 0,
  }
  await request((await store(QUEUE_STORE, 'readwrite')).add(entry))
  return entry.id
}

export async function dequeueAll(): Promise<QueuedMutation[]> {
  const items = await request((await store(QUEUE_STORE, 'readonly')).getAll())
  return ((items as QueuedMutation[]) ?? []).sort(byTimestamp)
}

export async function updateQueueEntry(entry: QueuedMutation): Promise<void> {
  await request((await store(QUEUE_STORE, 'readwrite')).put(entry))
}

export async function removeFromQueue(id: string): Promise<void> {
  await request((await store(QUEUE_STORE, 'readwrite')).delete(id))
}

export async function queueCount(): Promise<number> {
  return request((await store(QUEUE_STORE, 'readonly')).count())
}

// ── Bandeja de conflictos ─────────────────────────────────────────────────────

/** Mueve el item de la cola a la bandeja de conflictos en una sola transacción. */
export async function moveToFailed(entry: QueuedMutation, error: string): Promise<void> {
  const db = await openDB()
  const t = db.transaction([QUEUE_STORE, FAILED_STORE], 'readwrite')
  const failed: FailedMutation = { ...entry, lastError: error, failedAt: Date.now() }
  t.objectStore(FAILED_STORE).put(failed)
  t.objectStore(QUEUE_STORE).delete(entry.id)
  await transactionDone(t)
}

export async function getFailed(): Promise<FailedMutation[]> {
  const items = await request((await store(FAILED_STORE, 'readonly')).getAll())
  return ((items as FailedMutation[]) ?? []).sort(byTimestamp)
}

export async function failedCount(): Promise<number> {
  return request((await store(FAILED_STORE, 'readonly')).count())
}

/** Devuelve el item a la cola con los reintentos en cero. Conserva su timestamp original para no alterar el orden. */
export async function requeueFailed(id: string): Promise<void> {
  const db = await openDB()
  const t = db.transaction([QUEUE_STORE, FAILED_STORE], 'readwrite')
  const failedStore = t.objectStore(FAILED_STORE)
  const item = (await request(failedStore.get(id))) as FailedMutation | undefined
  if (item) {
    const { failedAt: _failedAt, ...rest } = item
    t.objectStore(QUEUE_STORE).put({ ...rest, retries: 0 } satisfies QueuedMutation)
    failedStore.delete(id)
  }
  await transactionDone(t)
}

export async function discardFailed(id: string): Promise<void> {
  await request((await store(FAILED_STORE, 'readwrite')).delete(id))
}

// ── Mapa localId → realId (persistente entre corridas de sync) ────────────────

export async function getIdMap(): Promise<Map<string, string>> {
  const rows = (await request((await store(ID_MAP_STORE, 'readonly')).getAll())) as IdMapping[]
  return new Map((rows ?? []).map((r) => [r.localId, r.realId]))
}

export async function saveIdMapping(localId: string, realId: string): Promise<void> {
  const row: IdMapping = { localId, realId, createdAt: Date.now() }
  await request((await store(ID_MAP_STORE, 'readwrite')).put(row))
}
