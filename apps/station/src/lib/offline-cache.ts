import type { DocumentNode } from '@apollo/client'

/**
 * Inserta (o reemplaza por id) un item en una lista ya cacheada, para que una operación
 * encolada offline se vea en la UI. El item debe traer todos los campos del fragment de la
 * lista. Si la lista no está en cache solo se crea con `createIfMissing` (p. ej. la lista de
 * una entidad creada offline, que en el servidor todavía no existe).
 */
export function upsertInCachedList(
  cache: any,
  opts: {
    query: DocumentNode
    variables: Record<string, unknown>
    field: string
    item: { id: string }
    position?: 'start' | 'end'
    createIfMissing?: boolean
  }
) {
  const { query, variables, field, item, position = 'start', createIfMissing = false } = opts
  let existing: Record<string, any[]> | null = null
  try {
    existing = cache.readQuery({ query, variables })
  } catch {
    existing = null
  }
  const list = existing?.[field]
  if (!list && !createIfMissing) return
  const rest = (list ?? []).filter((x: { id: string }) => x.id !== item.id)
  const next = position === 'start' ? [item, ...rest] : [...rest, item]
  cache.writeQuery({ query, variables, data: { [field]: next } })
}

/** Escribe una lista vacía si todavía no existe (entidad creada offline: no hay nada en el servidor). */
export function ensureEmptyList(cache: any, query: DocumentNode, variables: Record<string, unknown>, field: string) {
  let existing: unknown = null
  try {
    existing = cache.readQuery({ query, variables })
  } catch {
    existing = null
  }
  if (!existing) cache.writeQuery({ query, variables, data: { [field]: [] } })
}
