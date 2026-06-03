'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/company'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

interface Company {
  id: string
  name: string
  address: string | null
  phone: string | null
  logo: string | null
  createdAt: string
}

export default function CompaniesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ companies: Company[] }>(QUERIES.companies)
  const [deleteCompany, { loading: deleting }] = useMutation(MUTATIONS.deleteCompany)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteCompany({ variables: { id: deleteId } })
      toast.success('Empresa eliminada correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar la empresa.')
    } finally {
      setDeleteId(null)
    }
  }

  const columns: ColumnDef<Company>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'address',
      header: 'Dirección',
      cell: ({ row }) => row.original.address || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Teléfono',
      cell: ({ row }) => row.original.phone || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: () => <Badge variant="secondary">Activa</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push(`/admin/companies/${row.original.id}/edit`)}
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
        title="Empresas"
        description="Gestiona las empresas registradas en el sistema"
        action={
          <Button onClick={() => router.push('/admin/companies/new')} size="sm">
            <Plus className="size-4" />
            Nueva empresa
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.companies ?? []}
        loading={loading}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
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
