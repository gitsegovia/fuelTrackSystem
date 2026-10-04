import {
  dequeueAll,
  enqueue,
  getFailed,
  getIdMap,
  moveToFailed,
  removeFromQueue,
  saveIdMapping,
  updateQueueEntry,
  type QueuedMutation,
} from './offline-db'

type Vars = Record<string, unknown>

// 'offline': sin red · 'waiting-dependency': hay red, pero depende de algo aún no sincronizado
export type QueueReason = 'offline' | 'waiting-dependency'

/** Id estable por operación: el mismo en el intento online, en la cola y en cada reintento. */
export const MUTATION_ID_HEADER = 'x-offline-mutation-id'

export const MAX_RETRIES = 3

/** Reemplaza en las variables todo localId ya reconciliado por su ID real. */
export function remapKnownIds(variables: Vars, idMap: Map<string, string>): Vars {
  let json = JSON.stringify(variables)
  let changed = false
  for (const [localId, realId] of idMap) {
    if (json.includes(localId)) {
      json = json.split(localId).join(realId)
      changed = true
    }
  }
  return changed ? JSON.parse(json) : variables
}

/**
 * Devuelve el localId de un productor aún no sincronizado (en cola o en la bandeja
 * de conflictos) que estas variables referencian, o null si pueden enviarse ya.
 */
export function findPendingRef(
  variables: Vars,
  pendingProducers: Set<string>,
  opts: { ownLocalId?: string; dependsOn?: string } = {}
): string | null {
  const { ownLocalId, dependsOn } = opts
  if (dependsOn && dependsOn !== ownLocalId && pendingProducers.has(dependsOn)) return dependsOn
  const json = JSON.stringify(variables)
  for (const localId of pendingProducers) {
    if (localId !== ownLocalId && json.includes(localId)) return localId
  }
  return null
}

export async function getPendingProducers(): Promise<Set<string>> {
  const [queue, failed] = await Promise.all([dequeueAll(), getFailed()])
  return new Set(
    [...queue, ...failed].map((i) => i.localId).filter((id): id is string => !!id)
  )
}

/**
 * Para una mutation que se va a enviar online: aplica los IDs reales conocidos y
 * detecta si todavía depende de algo que no se sincronizó (en ese caso hay que encolarla).
 */
export async function resolveForSend(
  variables: Vars,
  dependsOn?: string
): Promise<{ variables: Vars; blockedBy: string | null }> {
  const [idMap, pending] = await Promise.all([getIdMap(), getPendingProducers()])
  const remapped = remapKnownIds(variables, idMap)
  return { variables: remapped, blockedBy: findPendingRef(remapped, pending, { dependsOn }) }
}

// ── Envío de una operación (online con fallback a la cola) ────────────────────

export interface SendOrQueueOptions {
  online: boolean
  operationName: string
  query: string
  variables: Vars
  localId?: string
  dependsOn?: string
  createdBy?: string
  deviceFingerprint?: string
  send: (args: { variables: Vars; headers: Record<string, string> }) => Promise<unknown>
  isNetworkError: (err: unknown) => boolean
}

export type SendOrQueueResult =
  | { queued: false; data: unknown; mutationId: string }
  | { queued: true; reason: QueueReason; mutationId: string }

/**
 * Online: envía con el header de id. Si la red cae en pleno envío, el item se encola con
 * ese MISMO id (el servidor pudo haberla aplicado). Offline o bloqueada por una dependencia
 * pendiente: se encola directamente. Errores de aplicación se relanzan.
 */
export async function sendOrQueue(opts: SendOrQueueOptions): Promise<SendOrQueueResult> {
  const mutationId = crypto.randomUUID()
  const queue = async (variables: Vars, reason: QueueReason, dependsOn = opts.dependsOn) => {
    await enqueue({
      id: mutationId,
      operationName: opts.operationName,
      query: opts.query,
      variables,
      localId: opts.localId,
      dependsOn,
      createdBy: opts.createdBy,
      deviceFingerprint: opts.deviceFingerprint,
    })
    return { queued: true as const, reason, mutationId }
  }

  if (!opts.online) return queue(opts.variables, 'offline')

  const resolved = await resolveForSend(opts.variables, opts.dependsOn)
  if (resolved.blockedBy) {
    return queue(resolved.variables, 'waiting-dependency', opts.dependsOn ?? resolved.blockedBy)
  }

  try {
    const data = await opts.send({
      variables: resolved.variables,
      headers: { [MUTATION_ID_HEADER]: mutationId },
    })
    return { queued: false, data, mutationId }
  } catch (err) {
    if (opts.isNetworkError(err)) return queue(resolved.variables, 'offline')
    throw err
  }
}

// ── Sincronización de la cola ─────────────────────────────────────────────────

export function syncHeaders(item: QueuedMutation): Record<string, string> {
  return {
    [MUTATION_ID_HEADER]: item.id,
    'x-offline-created-by': item.createdBy ?? '',
    'x-offline-device-fp': item.deviceFingerprint ?? '',
    'x-offline-queued-at': new Date(item.timestamp).toISOString(),
  }
}

export interface SyncResult {
  synced: number
  movedToFailed: number
  hadError: boolean
}

/**
 * Procesa la cola en orden. Un item cuyo productor sigue pendiente espera; un error de red
 * corta la corrida sin contar intento; un error de servidor suma intento y, al llegar a
 * MAX_RETRIES, el item pasa a la bandeja de conflictos (nunca se borra en silencio).
 */
export async function syncQueue(
  queue: QueuedMutation[],
  deps: {
    mutate: (args: { query: string; variables: Vars; headers: Record<string, string> }) => Promise<unknown>
    isNetworkError: (err: unknown) => boolean
  }
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, movedToFailed: 0, hadError: false }
  const idMap = await getIdMap()
  const failed = await getFailed()
  // localIds cuyo create todavía no llegó al servidor: sus dependientes esperan.
  const pending = new Set(
    [...queue, ...failed].map((i) => i.localId).filter((id): id is string => !!id)
  )

  for (const item of queue) {
    // Items de la versión anterior que ya habían agotado reintentos: no se borran.
    if (item.retries >= MAX_RETRIES) {
      await moveToFailed(item, item.lastError ?? 'Reintentos agotados')
      result.movedToFailed++
      continue
    }

    const variables = remapKnownIds(item.variables, idMap)
    if (findPendingRef(variables, pending, { ownLocalId: item.localId, dependsOn: item.dependsOn })) {
      continue
    }
    if (variables !== item.variables) {
      await updateQueueEntry({ ...item, variables })
    }

    try {
      const data = await deps.mutate({ query: item.query, variables, headers: syncHeaders(item) })
      if (item.localId) {
        const realId = extractFirstId(data)
        if (realId) {
          await saveIdMapping(item.localId, realId)
          idMap.set(item.localId, realId)
        }
        pending.delete(item.localId)
      }
      await removeFromQueue(item.id)
      result.synced++
    } catch (err) {
      result.hadError = true
      if (deps.isNetworkError(err)) break
      console.warn('[FuelTrack] Sync failed for', item.operationName, err)
      const lastError = (err as Error)?.message || 'Error desconocido'
      const retries = item.retries + 1
      if (retries >= MAX_RETRIES) {
        await moveToFailed({ ...item, variables, retries }, lastError)
        result.movedToFailed++
      } else {
        await updateQueueEntry({ ...item, variables, retries, lastError })
      }
    }
  }
  return result
}

export function extractFirstId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  for (const value of Object.values(data as object)) {
    if (value && typeof value === 'object' && 'id' in value) {
      return (value as { id: string }).id
    }
  }
  return null
}
