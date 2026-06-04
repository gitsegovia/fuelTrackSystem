'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/saleTypeConfig'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SaleTypeConfig {
  id: string
  saleTypeName: string
  salePricePerLiter: string
  percentage: string
  gasStation: { id: string; name: string }
  fuelType: { id: string; name: string }
  currency: { id: string; name: string; symbol: string }
  createdAt: string
}

const saleTypeLabels: Record<string, string> = {
  REGULAR: 'Regular',
  PREMIUM: 'Premium',
  SUBSIDIZED: 'Subsidiado',
}

export default function SaleTypeConfigsPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ saleTypeConfigs: SaleTypeConfig[] }>(QUERIES.saleTypeConfigs)
  const [deleteConfig, { loading: deleting }] = useMutation(MUTATIONS.deleteSaleTypeConfig)

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteConfig({ variables: { id: deleteId } })
      toast.success('Configuración eliminada correctamente.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar la configuración.')
    } finally {
      setDeleteId(null)
    }
  }

  const columns: ColumnDef<SaleTypeConfig>[] = [
    {
      id: 'station',
      header: 'Estación',
      cell: ({ row }) => <span className="font-medium">{row.original.gasStation.name}</span>,
    },
    {
      id: 'fuelType',
      header: 'Combustible',
      cell: ({ row }) => <span>{row.original.fuelType.name}</span>,
    },
    {
      accessorKey: 'saleTypeName',
      header: 'Tipo de venta',
      cell: ({ row }) => (
        <Badge variant="secondary">{saleTypeLabels[row.original.saleTypeName] ?? row.original.saleTypeName}</Badge>
      ),
    },
    {
      accessorKey: 'salePricePerLiter',
      header: 'Precio / litro',
      cell: ({ row }) => (
        <span>{row.original.currency.symbol} {Number(row.original.salePricePerLiter).toFixed(2)}</span>
      ),
    },
    {
      accessorKey: 'percentage',
      header: 'Porcentaje',
      cell: ({ row }) => <span>{Number(row.original.percentage).toFixed(2)}%</span>,
    },
    {
      id: 'currency',
      header: 'Moneda',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.currency.name}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-sm"
            onClick={() => router.push(`/admin/sale-type-configs/${row.original.id}/edit`)}>
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
        title="Tipos de venta"
        description="Configuración de precios por estación, combustible y modalidad de venta"
        action={
          <Button onClick={() => router.push('/admin/sale-type-configs/new')} size="sm">
            <Plus className="size-4" /> Nueva configuración
          </Button>
        }
      />

      <DataTable columns={columns} data={data?.saleTypeConfigs ?? []} loading={loading} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar configuración?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Verifica que no haya tickets de venta asociados.
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
