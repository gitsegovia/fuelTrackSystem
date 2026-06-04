'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, PackagePlus } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/invoice'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

const FUEL_KIND_LABELS: Record<string, string> = {
  GASOLINE_91: 'Gasolina 91',
  GASOLINE_95: 'Gasolina 95',
  DIESEL: 'Diésel',
  KEROSENE: 'Kerosene',
}

type Invoice = {
  id: string
  invoiceNumber: string
  fuelKind: string
  liters: string
  totalAmount: string
  dispatchDate: string
  receivingGasStation: { id: string; name: string }
  currency: { id: string; symbol: string }
}

export default function InvoicesPage() {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { data, loading } = useQuery<{ invoices: Invoice[] }>(QUERIES.invoices)
  const [deleteInvoice] = useMutation(MUTATIONS.deleteInvoice, {
    refetchQueries: [{ query: QUERIES.invoices }],
  })

  const columns: ColumnDef<Invoice>[] = [
    { accessorKey: 'invoiceNumber', header: 'N° Factura' },
    {
      header: 'Estación',
      cell: ({ row }) => row.original.receivingGasStation.name,
    },
    {
      header: 'Combustible',
      cell: ({ row }) => FUEL_KIND_LABELS[row.original.fuelKind] ?? row.original.fuelKind,
    },
    {
      header: 'Litros',
      cell: ({ row }) => parseFloat(row.original.liters).toLocaleString(),
    },
    {
      header: 'Total',
      cell: ({ row }) =>
        `${row.original.currency.symbol} ${parseFloat(row.original.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Fecha despacho',
      cell: ({ row }) => format(new Date(row.original.dispatchDate), 'dd/MM/yyyy'),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/invoices/${row.original.id}/reception/new`}>
              <PackagePlus className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/invoices/${row.original.id}/edit`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteInvoice({ variables: { id: deleteId } })
      toast.success('Factura eliminada.')
    } catch {
      toast.error('No se pudo eliminar la factura.')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas de despacho"
        description="Registros de combustible recibido de proveedores"
        action={
          <Button size="sm" asChild>
            <Link href="/admin/invoices/new">
              <Plus className="size-4" /> Nueva factura
            </Link>
          </Button>
        }
      />
      <DataTable columns={columns} data={data?.invoices ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
