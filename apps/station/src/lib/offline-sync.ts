import { dequeueAll, getFailed, getIdMap } from './offline-db'

type Vars = Record<string, unknown>

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

export function extractFirstId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  for (const value of Object.values(data as object)) {
    if (value && typeof value === 'object' && 'id' in value) {
      return (value as { id: string }).id
    }
  }
  return null
}
