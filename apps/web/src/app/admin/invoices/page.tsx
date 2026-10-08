'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, PackagePlus, Lock, Eye } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/invoice'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { useAuth } from '@/hooks/useAuth'
import { isStationScoped } from '@/lib/permissions'
import { useLicense } from '@/context/LicenseContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 min-w-[200px] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'
)

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
  status: 'PENDING' | 'CLOSED'
  receivingGasStation: { name: string }
  currency: { symbol: string }
  dispatchReceptions: { receivedLiters: string }[]
}

export default function InvoicesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { license } = useLicense()
  const canWrite = !license?.readOnly
  const stationScoped = isStationScoped(user)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [closeId, setCloseId] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationId] = useState<string>(
    stationScoped ? user?.assignedGasStation?.id ?? '' : ''
  )

  const { data: stationsData } = useQuery<{
    gasStations: { id: string; name: string; code: string; company: { id: string } }[]
  }>(GasStationQueries.gasStations)
  const stations = (stationsData?.gasStations ?? []).filter(
    (s) => (!user?.company?.id || s.company.id === user.company.id)
      && (!stationScoped || s.id === user?.assignedGasStation?.id)
  )

  const queryVariables = {
    gasStationId: selectedStationId || null,
    companyId: user?.company?.id || null,
  }
  const { data, loading } = useQuery<{ invoices: Invoice[] }>(QUERIES.invoices, {
    variables: queryVariables,
    skip: !user,
  })
  const [deleteInvoice] = useMutation(MUTATIONS.deleteInvoice, {
    refetchQueries: [{ query: QUERIES.invoices, variables: queryVariables }],
  })
  const [closeInvoice, { loading: closing }] = useMutation(MUTATIONS.closeInvoice, {
    refetchQueries: [{ query: QUERIES.invoices, variables: queryVariables }],
  })

  const columns: ColumnDef<Invoice>[] = [
    { accessorKey: 'invoiceNumber', header: 'N° Factura' },
    { header: 'Estación', cell: ({ row }) => row.original.receivingGasStation.name },
    { header: 'Combustible', cell: ({ row }) => FUEL_KIND_LABELS[row.original.fuelKind] ?? row.original.fuelKind },
    {
      header: 'Litros',
      cell: ({ row }) => {
        const total = parseFloat(row.original.liters)
        const received = row.original.dispatchReceptions.reduce((s, r) => s + parseFloat(r.receivedLiters), 0)
        return (
          <span>
            {received.toLocaleString()} / {total.toLocaleString()} L
          </span>
        )
      },
    },
    {
      header: 'Total',
      cell: ({ row }) =>
        `${row.original.currency.symbol} ${parseFloat(row.original.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Fecha',
      cell: ({ row }) => format(new Date(row.original.dispatchDate), 'dd/MM/yyyy'),
    },
    {
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'CLOSED' ? 'secondary' : 'outline'}
          className={row.original.status === 'CLOSED' ? 'text-muted-foreground' : 'text-primary border-primary/40'}>
          {row.original.status === 'CLOSED' ? 'Cerrada' : 'Pendiente'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => router.push(`/admin/invoices/${row.original.id}`)}>
            <Eye className="size-4" />
          </Button>
          {canWrite && row.original.status === 'PENDING' && (
            <>
              <Button variant="ghost" size="icon" title="Registrar descarga" onClick={() => router.push(`/admin/invoices/${row.original.id}/reception/new`)}>
                <PackagePlus className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Cerrar factura" onClick={() => setCloseId(row.original.id)}>
                <Lock className="size-4" />
              </Button>
            </>
          )}
          {canWrite && (
            <>
              <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/invoices/${row.original.id}/edit`)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </>
          )}
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

  const handleClose = async () => {
    if (!closeId) return
    try {
      await closeInvoice({ variables: { id: closeId } })
      toast.success('Factura cerrada. No se pueden agregar más recepciones.')
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo cerrar la factura.')
    } finally {
      setCloseId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas de despacho"
        description="Registros de combustible recibido de proveedores"
        action={canWrite ? (
          <Button size="sm" onClick={() => router.push('/admin/invoices/new')}>
            <Plus className="size-4" /> Nueva factura
          </Button>
        ) : undefined}
      />

      <div className="flex items-end gap-2">
        <Label className="text-xs text-muted-foreground mb-1.5">Estación</Label>
        <select
          className={selectClass}
          value={selectedStationId}
          onChange={(e) => setSelectedStationId(e.target.value)}
          disabled={stationScoped}
        >
          {!stationScoped && <option value="">Todas mis estaciones</option>}
          {stations.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>
      </div>

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

      <AlertDialog open={!!closeId} onOpenChange={(o) => !o && setCloseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              La factura quedará cerrada y no podrán registrarse más recepciones de descarga. Esta acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={closing}>
              {closing ? 'Cerrando...' : 'Cerrar factura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
