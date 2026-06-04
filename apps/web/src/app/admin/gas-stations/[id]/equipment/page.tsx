'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2,
  Layers, Droplets, Gauge, CircleDot, ArrowLeft, History,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES as GS_QUERIES } from '@/services/graphql/gql/gasStation'
import { QUERIES as ISLAND_QUERIES, MUTATIONS as ISLAND_MUTATIONS } from '@/services/graphql/gql/pumpIsland'
import { QUERIES as DISP_QUERIES, MUTATIONS as DISP_MUTATIONS } from '@/services/graphql/gql/dispenser'
import { QUERIES as NOZZLE_QUERIES, MUTATIONS as NOZZLE_MUTATIONS } from '@/services/graphql/gql/dispenserNozzle'
import { QUERIES as TANK_QUERIES, MUTATIONS as TANK_MUTATIONS } from '@/services/graphql/gql/tank'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PumpIsland { id: string; name: string; description: string | null }
interface Dispenser { id: string; name: string; isOperational: boolean; pumpIslandId: string; fuelType: { name: string }; tank: { name: string } }
interface Nozzle { id: string; name: string; isOperational: boolean; initialMeterReading: string; currentMeterReading: string }
interface Tank { id: string; name: string; maxCapacityLiters: string; currentVolumeLiters: string | null; fuelType: { name: string }; tankModel: { name: string; nominalCapacity: string } }

type DeleteTarget = { type: 'island' | 'dispenser' | 'nozzle' | 'tank'; id: string; name: string; dispenserId?: string }

// ─── Nozzle list (lazy-loaded per dispenser) ──────────────────────────────────

function NozzleList({ dispenserId, stationId, islandId, onEdit, onDelete }: {
  dispenserId: string
  stationId: string
  islandId: string
  onEdit: (id: string) => void
  onDelete: (target: DeleteTarget) => void
}) {
  const { data, loading } = useQuery<{ dispenserNozzlesByDispenser: Nozzle[] }>(
    NOZZLE_QUERIES.dispenserNozzlesByDispenser,
    { variables: { dispenserId } }
  )
  const router = useRouter()

  if (loading) return <div className="py-2 px-4 text-xs text-muted-foreground">Cargando boquillas...</div>

  const nozzles = data?.dispenserNozzlesByDispenser ?? []

  return (
    <div className="bg-muted/20">
      {nozzles.length === 0 ? (
        <p className="py-3 px-12 text-xs text-muted-foreground">Sin boquillas registradas</p>
      ) : (
        nozzles.map((nozzle) => (
          <div key={nozzle.id} className="flex items-center gap-3 px-12 py-2 border-t border-border/40 hover:bg-muted/30 transition-colors">
            <CircleDot className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">{nozzle.name}</span>
            <span className="text-xs text-muted-foreground">Lectura: {parseFloat(nozzle.currentMeterReading).toLocaleString()}</span>
            <Badge variant={nozzle.isOperational ? 'default' : 'secondary'} className="text-xs">
              {nozzle.isOperational ? 'Operativa' : 'Inactiva'}
            </Badge>
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(nozzle.id)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive"
              onClick={() => onDelete({ type: 'nozzle', id: nozzle.id, name: nozzle.name, dispenserId })}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))
      )}
      <div className="px-12 py-2 border-t border-border/40">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"
          onClick={() => router.push(`/admin/gas-stations/${stationId}/equipment/nozzles/new?dispenserId=${dispenserId}&expandIsland=${islandId}`)}>
          <Plus className="size-3.5" /> Añadir boquilla
        </Button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const { id: stationId } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const expandIslandParam = searchParams.get('expandIsland')

  const [expandedIslands, setExpandedIslands] = useState<Set<string>>(new Set())
  const [expandedDispensers, setExpandedDispensers] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  // Auto-expand the island indicated by the URL param on mount
  useEffect(() => {
    if (expandIslandParam) {
      setExpandedIslands((prev) => new Set([...prev, expandIslandParam]))
    }
  }, [expandIslandParam])

  // Queries
  const { data: stationData } = useQuery<{ gasStation: { id: string; name: string; code: string } }>(
    GS_QUERIES.gasStation, { variables: { id: stationId }, skip: !stationId }
  )
  const { data: islandsData, loading: islandsLoading, refetch: refetchIslands } =
    useQuery<{ pumpIslandsByGasStation: PumpIsland[] }>(
      ISLAND_QUERIES.pumpIslandsByGasStation, { variables: { gasStationId: stationId }, skip: !stationId }
    )
  const { data: dispensersData, refetch: refetchDispensers } =
    useQuery<{ dispensersByGasStation: Dispenser[] }>(
      DISP_QUERIES.dispensersByGasStation, { variables: { gasStationId: stationId }, skip: !stationId }
    )
  const { data: tanksData, loading: tanksLoading, refetch: refetchTanks } =
    useQuery<{ tanksByGasStation: Tank[] }>(
      TANK_QUERIES.tanksByGasStation, { variables: { gasStationId: stationId }, skip: !stationId }
    )

  // Mutations
  const [deleteIsland, { loading: deletingIsland }] = useMutation(ISLAND_MUTATIONS.deletePumpIsland)
  const [deleteDispenser, { loading: deletingDispenser }] = useMutation(DISP_MUTATIONS.deleteDispenser)
  const [deleteNozzle, { loading: deletingNozzle }] = useMutation(NOZZLE_MUTATIONS.deleteDispenserNozzle)
  const [deleteTank, { loading: deletingTank }] = useMutation(TANK_MUTATIONS.deleteTank)

  const deleting = deletingIsland || deletingDispenser || deletingNozzle || deletingTank

  const toggleIsland = (id: string) => setExpandedIslands((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleDispenser = (id: string) => setExpandedDispensers((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { type, id } = deleteTarget
    try {
      if (type === 'island') { await deleteIsland({ variables: { id } }); refetchIslands(); refetchDispensers() }
      if (type === 'dispenser') { await deleteDispenser({ variables: { id } }); refetchDispensers() }
      if (type === 'nozzle') {
        await deleteNozzle({
          variables: { id },
          refetchQueries: deleteTarget.dispenserId
            ? [{ query: NOZZLE_QUERIES.dispenserNozzlesByDispenser, variables: { dispenserId: deleteTarget.dispenserId } }]
            : [],
        })
      }
      if (type === 'tank') { await deleteTank({ variables: { id } }); refetchTanks() }
      toast.success('Eliminado correctamente.')
    } catch {
      toast.error('No se pudo eliminar. Verifique dependencias.')
    } finally {
      setDeleteTarget(null)
    }
  }

  const islands = islandsData?.pumpIslandsByGasStation ?? []
  const dispensers = dispensersData?.dispensersByGasStation ?? []
  const tanks = tanksData?.tanksByGasStation ?? []
  const stationName = stationData?.gasStation?.name ?? '...'

  const navTo = (path: string) => `/admin/gas-stations/${stationId}/equipment/${path}`

  // Tank columns
  const tankColumns: ColumnDef<Tank>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { id: 'fuelType', header: 'Combustible', cell: ({ row }) => row.original.fuelType.name },
    { id: 'model', header: 'Modelo', cell: ({ row }) => row.original.tankModel.name },
    {
      accessorKey: 'maxCapacityLiters',
      header: 'Cap. máx (L)',
      cell: ({ row }) => `${parseFloat(row.original.maxCapacityLiters).toLocaleString()} L`,
    },
    {
      id: 'current',
      header: 'Nivel actual (L)',
      cell: ({ row }) => row.original.currentVolumeLiters
        ? `${parseFloat(row.original.currentVolumeLiters).toLocaleString()} L`
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" title="Historial de despachos"
            onClick={() => router.push(navTo(`tanks/${row.original.id}/receptions`))}>
            <History className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm"
            onClick={() => router.push(navTo(`tanks/${row.original.id}/edit`))}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget({ type: 'tank', id: row.original.id, name: row.original.name })}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Equipamiento: ${stationName}`}
        description="Gestiona islas, dispensadores, boquillas y tanques"
        action={
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/gas-stations')}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {/* ── Islas y Dispensadores ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="size-4 text-muted-foreground" /> Islas y Dispensadores
          </h2>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => router.push(navTo('pump-islands/new'))}>
            <Plus className="size-3.5" /> Nueva isla
          </Button>
        </div>

        {islandsLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : islands.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Layers className="size-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No hay islas registradas</p>
            <Button size="sm" variant="outline" className="mt-3 text-xs gap-1.5"
              onClick={() => router.push(navTo('pump-islands/new'))}>
              <Plus className="size-3.5" /> Crear primera isla
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {islands.map((island, idx) => {
              const islandOpen = expandedIslands.has(island.id)
              const isActive = island.id === expandIslandParam
              const islandDispensers = dispensers.filter((d) => d.pumpIslandId === island.id)

              return (
                <div key={island.id} className={cn(idx > 0 && 'border-t border-border')}>
                  {/* Island row */}
                  <div className={cn(
                    'flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors',
                    isActive && 'border-l-2 border-l-amber-500 bg-amber-500/5'
                  )}>
                    <button
                      onClick={() => toggleIsland(island.id)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      {islandOpen
                        ? <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
                      <Layers className={cn('size-4 shrink-0', isActive ? 'text-amber-500' : 'text-primary')} />
                      <span className="text-sm font-semibold">{island.name}</span>
                      {island.description && (
                        <span className="text-xs text-muted-foreground truncate">— {island.description}</span>
                      )}
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {islandDispensers.length} disp.
                      </Badge>
                    </button>
                    <Button variant="ghost" size="icon-sm"
                      onClick={() => router.push(navTo(`dispensers/new?pumpIslandId=${island.id}&expandIsland=${island.id}`))}>
                      <Plus className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm"
                      onClick={() => router.push(navTo(`pump-islands/${island.id}/edit?expandIsland=${island.id}`))}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget({ type: 'island', id: island.id, name: island.name })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* Dispensers accordion */}
                  {islandOpen && (
                    <div className="bg-muted/10">
                      {islandDispensers.length === 0 ? (
                        <p className="py-3 px-10 text-xs text-muted-foreground">Sin dispensadores</p>
                      ) : (
                        islandDispensers.map((disp) => {
                          const dispOpen = expandedDispensers.has(disp.id)
                          return (
                            <div key={disp.id} className="border-t border-border/50">
                              {/* Dispenser row */}
                              <div className="flex items-center gap-3 px-8 py-2.5 hover:bg-muted/20 transition-colors">
                                <button
                                  onClick={() => toggleDispenser(disp.id)}
                                  className="flex items-center gap-2 flex-1 text-left"
                                >
                                  {dispOpen
                                    ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
                                  <Gauge className="size-3.5 text-amber-500 shrink-0" />
                                  <span className="text-sm font-medium">{disp.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {disp.fuelType.name} · {disp.tank.name}
                                  </span>
                                  <Badge variant={disp.isOperational ? 'default' : 'secondary'} className="ml-auto text-xs">
                                    {disp.isOperational ? 'Operativo' : 'Inactivo'}
                                  </Badge>
                                </button>
                                <Button variant="ghost" size="icon-sm"
                                  onClick={() => router.push(navTo(`dispensers/${disp.id}/edit?expandIsland=${island.id}`))}>
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget({ type: 'dispenser', id: disp.id, name: disp.name })}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>

                              {/* Nozzles (lazy) */}
                              {dispOpen && (
                                <NozzleList
                                  dispenserId={disp.id}
                                  stationId={stationId}
                                  islandId={island.id}
                                  onEdit={(nozzleId) => router.push(navTo(`nozzles/${nozzleId}/edit?expandIsland=${island.id}`))}
                                  onDelete={setDeleteTarget}
                                />
                              )}
                            </div>
                          )
                        })
                      )}
                      <div className="px-8 py-2 border-t border-border/50">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"
                          onClick={() => router.push(navTo(`dispensers/new?pumpIslandId=${island.id}&expandIsland=${island.id}`))}>
                          <Plus className="size-3.5" /> Añadir dispensador
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Tanques ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Droplets className="size-4 text-muted-foreground" /> Tanques
          </h2>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => router.push(navTo('tanks/new'))}>
            <Plus className="size-3.5" /> Nuevo tanque
          </Button>
        </div>

        <DataTable columns={tankColumns} data={tanks} loading={tanksLoading} />
      </section>

      {/* ── Delete dialog ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los elementos dependientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
