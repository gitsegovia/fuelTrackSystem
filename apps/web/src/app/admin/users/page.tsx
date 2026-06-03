'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/user'
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

interface User {
  id: string
  username: string
  role: string
  userType: string
  company: { id: string; name: string }
  assignedGasStation: { id: string; name: string } | null
  createdAt: string
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  EMPLOYEE: 'Empleado',
}

const roleVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  ADMIN: 'default',
  MANAGER: 'secondary',
  EMPLOYEE: 'outline',
}

export default function UsersPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ users: User[] }>(QUERIES.users)
  const [deleteUser, { loading: deleting }] = useMutation(MUTATIONS.deleteUser)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteUser({ variables: { id: deleteId } })
      toast.success('Usuario eliminado correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar el usuario.')
    } finally {
      setDeleteId(null)
    }
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'username',
      header: 'Usuario',
      cell: ({ row }) => <span className="font-medium">{row.original.username}</span>,
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge variant={roleVariants[row.original.role] ?? 'outline'}>
          {roleLabels[row.original.role] ?? row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'userType',
      header: 'Tipo',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.userType}</span>
      ),
    },
    {
      id: 'station',
      header: 'Estación',
      cell: ({ row }) =>
        row.original.assignedGasStation ? (
          <span>{row.original.assignedGasStation.name}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
            onClick={() => router.push(`/admin/users/${row.original.id}/edit`)}
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
        title="Usuarios"
        description="Gestiona los usuarios del sistema"
        action={
          <Button onClick={() => router.push('/admin/users/new')} size="sm">
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
        }
      />

      <DataTable columns={columns} data={data?.users ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
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
