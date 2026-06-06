// IndexedDB wrapper para la cola de mutations offline
// Sin dependencias externas — usa la API nativa del browser

const DB_NAME = 'fueltrack-offline'
const QUEUE_STORE = 'mutation-queue'
const DB_VERSION = 1

export interface QueuedMutation {
  id: string
  operationName: string
  query: string          // documento GQL serializado con print()
  variables: Record<string, unknown>
  timestamp: number
  retries: number
  localId?: string       // UUID temporal generado offline (para reconciliación de IDs)
  dependsOn?: string     // localId del que depende (para ordenar y remap en sync)
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
    }
  })
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store)
}

export async function enqueue(
  mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>
): Promise<void> {
  const db = await openDB()
  const entry: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retries: 0,
  }
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, QUEUE_STORE, 'readwrite').add(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function dequeueAll(): Promise<QueuedMutation[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, QUEUE_STORE, 'readonly').getAll()
    req.onsuccess = () =>
      resolve(((req.result as QueuedMutation[]) ?? []).sort((a, b) => a.timestamp - b.timestamp))
    req.onerror = () => reject(req.error)
  })
}

export async function updateQueueEntry(entry: QueuedMutation): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, QUEUE_STORE, 'readwrite').put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, QUEUE_STORE, 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await openDB()
  const store = tx(db, QUEUE_STORE, 'readwrite')
  const entry: QueuedMutation = await new Promise((resolve, reject) => {
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  if (entry) {
    entry.retries += 1
    await new Promise<void>((resolve, reject) => {
      const req = tx(db, QUEUE_STORE, 'readwrite').put(entry)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

export async function clearQueue(): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, QUEUE_STORE, 'readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function queueCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, QUEUE_STORE, 'readonly').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
