'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/fuelType'
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

interface FuelType {
  id: string
  name: string
  costPerLiter: string
  createdAt: string
}

export default function FuelTypesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ fuelTypes: FuelType[] }>(QUERIES.fuelTypes)
  const [deleteFuelType, { loading: deleting }] = useMutation(MUTATIONS.deleteFuelType)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteFuelType({ variables: { id: deleteId } })
      toast.success('Tipo de combustible eliminado correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar el tipo de combustible.')
    } finally {
      setDeleteId(null)
    }
  }

  const columns: ColumnDef<FuelType>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'costPerLiter',
      header: 'Costo por litro',
      cell: ({ row }) => (
        <span>${Number(row.original.costPerLiter).toFixed(2)}</span>
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
            onClick={() => router.push(`/admin/fuel-types/${row.original.id}/edit`)}
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
        title="Tipos de combustible"
        description="Gestiona los tipos de combustible y sus costos"
        action={
          <Button onClick={() => router.push('/admin/fuel-types/new')} size="sm">
            <Plus className="size-4" />
            Nuevo tipo
          </Button>
        }
      />

      <DataTable columns={columns} data={data?.fuelTypes ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de combustible?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Verifica que no existan registros asociados.
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
