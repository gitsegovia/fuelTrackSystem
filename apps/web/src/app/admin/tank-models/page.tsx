'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, TableProperties } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/tankModel'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface TankModel {
  id: string
  name: string
  nominalCapacity: string
  shape: string
  description: string | null
  createdAt: string
}

export default function TankModelsPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ tankModels: TankModel[] }>(QUERIES.tankModels)
  const [deleteTankModel, { loading: deleting }] = useMutation(MUTATIONS.deleteTankModel)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteTankModel({ variables: { id: deleteId } })
      toast.success('Modelo eliminado correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar el modelo.')
    } finally {
      setDeleteId(null)
    }
  }

  const columns: ColumnDef<TankModel>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'shape',
      header: 'Forma',
    },
    {
      accessorKey: 'nominalCapacity',
      header: 'Capacidad nominal (L)',
      cell: ({ row }) => (
        <span>{parseFloat(row.original.nominalCapacity).toLocaleString()} L</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Descripción',
      cell: ({ row }) => row.original.description || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Calibración"
            onClick={() => router.push(`/admin/tank-models/${row.original.id}`)}
          >
            <TableProperties className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push(`/admin/tank-models/${row.original.id}/edit`)}
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
        title="Modelos de Tanque"
        description="Catálogo de modelos de tanques disponibles"
        action={
          <Button onClick={() => router.push('/admin/tank-models/new')} size="sm">
            <Plus className="size-4" />
            Nuevo modelo
          </Button>
        }
      />

      <DataTable columns={columns} data={data?.tankModels ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar modelo de tanque?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. No se puede eliminar si hay tanques que lo usan.
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
