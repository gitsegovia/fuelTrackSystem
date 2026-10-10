'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { canManageCatalogs } from '@/lib/permissions'
import { useLicense } from '@/context/LicenseContext'
import { licenseStationLimitMessage } from '@/lib/license-messages'
import { toast } from 'sonner'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { Plus, Pencil, Trash2, Wrench, PowerOff } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/gasStation'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface GasStation {
  id: string
  name: string
  code: string
  address: string | null
  active: boolean
  company: { id: string; name: string }
  createdAt: string
}

export default function GasStationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { license } = useLicense()
  const atStationLimit = license?.maxStations != null && license.activeStations >= license.maxStations
  const canManage = canManageCatalogs(user) && !license?.readOnly
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<GasStation | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const { data, loading, refetch } = useQuery<{ gasStations: GasStation[] }>(QUERIES.gasStations)
  const [deleteGasStation, { loading: deleting }] = useMutation(MUTATIONS.deleteGasStation)
  const [deactivateGasStation, { loading: deactivating }] = useMutation(MUTATIONS.deactivateGasStation, {
    refetchQueries: [{ query: QUERIES.gasStations }],
  })

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteGasStation({ variables: { id: deleteId } })
      toast.success('Estación eliminada correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar la estación.')
    } finally {
      setDeleteId(null)
    }
  }

  const closeDeactivateDialog = () => {
    setDeactivateTarget(null)
    setConfirmText('')
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    try {
      await deactivateGasStation({ variables: { id: deactivateTarget.id } })
      toast.success('Estación desactivada.')
      closeDeactivateDialog()
    } catch (err) {
      if (CombinedGraphQLErrors.is(err)) {
        const code = err.errors[0]?.extensions?.code
        if (code === 'STATION_HAS_OPEN_WORK') {
          const { openShifts, openTickets } = err.errors[0].extensions as {
            openShifts: number
            openTickets: number
          }
          toast.error(
            `No se puede desactivar: tiene ${openShifts} turnos abiertos y ${openTickets} tickets sin completar.`
          )
          return
        }
      }
      toast.error('No se pudo desactivar la estación.')
    }
  }

  const columns: ColumnDef<GasStation>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'code',
      header: 'Código',
    },
    {
      accessorKey: 'address',
      header: 'Dirección',
      cell: ({ row }) => row.original.address || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'company',
      header: 'Empresa',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.company.name}</span>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'secondary'}>
          {row.original.active ? 'Activa' : 'Desactivada'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (!row.original.active) {
          return (
            <span className="text-xs text-muted-foreground">
              Desactivada — para reactivarla, contacta a Core Code Innovation.
            </span>
          )
        }
        if (!canManage) return null
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Equipamiento"
              onClick={() => router.push(`/admin/gas-stations/${row.original.id}/equipment`)}
            >
              <Wrench className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push(`/admin/gas-stations/${row.original.id}/edit`)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Desactivar"
              onClick={() => setDeactivateTarget(row.original)}
              className="text-destructive hover:text-destructive"
            >
              <PowerOff className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleteId(row.original.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estaciones"
        description="Gestiona las estaciones de servicio"
        action={canManage ? (
          <Button
            onClick={() => router.push('/admin/gas-stations/new')}
            size="sm"
            disabled={atStationLimit}
            title={atStationLimit ? licenseStationLimitMessage(license?.maxStations ?? null) : undefined}
          >
            <Plus className="size-4" />
            Nueva estación
          </Button>
        ) : undefined}
      />

      {license?.maxStations != null && (
        <p className="text-sm text-muted-foreground">
          {license.activeStations} de {license.maxStations} estaciones
          {atStationLimit && ' — tope del plan alcanzado'}
        </p>
      )}

      <DataTable columns={columns} data={data?.gasStations ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.
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

      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && closeDeactivateDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar {deactivateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              La estación quedará solo como histórico: sus empleados no podrán entrar y no se
              podrá operar sobre ella. <strong>Solo Core Code Innovation puede reactivarla.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="confirm-deactivate-name" className="text-xs text-muted-foreground">
              Escribe <span className="font-medium text-foreground">{deactivateTarget?.name}</span> para confirmar
            </Label>
            <Input
              id="confirm-deactivate-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivating || confirmText !== deactivateTarget?.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivating ? 'Desactivando...' : 'Desactivar estación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
