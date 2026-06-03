'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/gasStation'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
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
  company: { id: string; name: string }
  createdAt: string
}

export default function GasStationsPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ gasStations: GasStation[] }>(QUERIES.gasStations)
  const [deleteGasStation, { loading: deleting }] = useMutation(MUTATIONS.deleteGasStation)

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
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
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
            onClick={() => setDeleteId(row.original.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estaciones"
        description="Gestiona las estaciones de servicio"
        action={
          <Button onClick={() => router.push('/admin/gas-stations/new')} size="sm">
            <Plus className="size-4" />
            Nueva estación
          </Button>
        }
      />

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
    </div>
  )
}
