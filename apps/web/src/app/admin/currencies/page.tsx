'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/currency'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Currency {
  id: string
  name: string
  symbol: string
  exchangeRate: string
  createdAt: string
}

export default function CurrenciesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ currencies: Currency[] }>(QUERIES.currencies)
  const [deleteCurrency, { loading: deleting }] = useMutation(MUTATIONS.deleteCurrency)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteCurrency({ variables: { id: deleteId } })
      toast.success('Moneda eliminada correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar la moneda.')
    } finally {
      setDeleteId(null)
    }
  }

  const columns: ColumnDef<Currency>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'symbol',
      header: 'Símbolo',
      cell: ({ row }) => <span className="font-mono">{row.original.symbol}</span>,
    },
    {
      accessorKey: 'exchangeRate',
      header: 'Tasa de cambio',
      cell: ({ row }) => <span>{Number(row.original.exchangeRate).toFixed(2)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-sm"
            onClick={() => router.push(`/admin/currencies/${row.original.id}/edit`)}>
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
        title="Monedas"
        description="Gestiona las monedas y tasas de cambio"
        action={
          <Button onClick={() => router.push('/admin/currencies/new')} size="sm">
            <Plus className="size-4" /> Nueva moneda
          </Button>
        }
      />

      <DataTable columns={columns} data={data?.currencies ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar moneda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Verifica que no existan registros asociados.
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
