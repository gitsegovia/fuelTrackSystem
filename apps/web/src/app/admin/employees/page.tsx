'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/employee'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Employee {
  id: string
  firstName: string
  lastName: string
  position: string
  user: { id: string; username: string; role: string }
  gasStation: { id: string; name: string }
  createdAt: string
}

export default function EmployeesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ employees: Employee[] }>(QUERIES.employees)
  const [deleteEmployee, { loading: deleting }] = useMutation(MUTATIONS.deleteEmployee)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteEmployee({ variables: { id: deleteId } })
      toast.success('Empleado eliminado correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar el empleado.')
    } finally {
      setDeleteId(null)
    }
  }

  const columns: ColumnDef<Employee>[] = [
    {
      id: 'name',
      header: 'Nombre',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.firstName} {row.original.lastName}</span>
      ),
    },
    {
      accessorKey: 'position',
      header: 'Cargo',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.position}</span>,
    },
    {
      id: 'user',
      header: 'Usuario',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.user.username}</span>
      ),
    },
    {
      id: 'gasStation',
      header: 'Estación',
      cell: ({ row }) => <span>{row.original.gasStation.name}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-sm"
            onClick={() => router.push(`/admin/employees/${row.original.id}/edit`)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm"
            onClick={() => setDeleteId(row.original.id)}
            className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description="Perfiles de empleados vinculados a usuarios del sistema"
        action={
          <Button onClick={() => router.push('/admin/employees/new')} size="sm">
            <Plus className="size-4" /> Nuevo empleado
          </Button>
        }
      />

      <DataTable columns={columns} data={data?.employees ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el perfil del empleado. El usuario del sistema no se verá afectado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
