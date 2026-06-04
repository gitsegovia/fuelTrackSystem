'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { ArrowLeft, Pencil, PackagePlus } from 'lucide-react'
import { QUERIES } from '@/services/graphql/gql/invoice'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'

const FUEL_KIND_LABELS: Record<string, string> = {
  GASOLINE_91: 'Gasolina 91',
  GASOLINE_95: 'Gasolina 95',
  DIESEL: 'Diésel',
  KEROSENE: 'Kerosene',
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading } = useQuery(QUERIES.invoice, { variables: { id }, skip: !id })
  const invoice = data?.invoice

  if (loading) return <Skeleton className="h-64 w-full max-w-3xl" />
  if (!invoice) return <p className="text-sm text-muted-foreground">Factura no encontrada.</p>

  const totalReceived = (invoice.dispatchReceptions ?? []).reduce(
    (s: number, r: any) => s + parseFloat(r.receivedLiters), 0
  )
  const invoiceLiters = parseFloat(invoice.liters)
  const variance = totalReceived - invoiceLiters

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={`Factura ${invoice.invoiceNumber}`}
        description={`${invoice.receivingGasStation.name} · ${FUEL_KIND_LABELS[invoice.fuelKind] ?? invoice.fuelKind}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="size-4" /> Volver
            </Button>
            {invoice.status === 'PENDING' && (
              <Button size="sm" onClick={() => router.push(`/admin/invoices/${id}/reception/new`)}>
                <PackagePlus className="size-4" /> Registrar descarga
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/invoices/${id}/edit`)}>
              <Pencil className="size-4" /> Editar
            </Button>
          </div>
        }
      />

      {/* Encabezado de la factura */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Datos de la factura</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">N° Control</span>
            <span className="font-medium">{invoice.controlNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">N° Precinto</span>
            <span className="font-medium">{invoice.sealNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Camión</span>
            <span className="font-medium">{invoice.truckIdentifier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant={invoice.status === 'CLOSED' ? 'secondary' : 'outline'}
              className={invoice.status === 'CLOSED' ? '' : 'text-primary border-primary/40'}>
              {invoice.status === 'CLOSED' ? 'Cerrada' : 'Pendiente'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha despacho</span>
            <span>{format(new Date(invoice.dispatchDate), 'dd/MM/yyyy HH:mm')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha descarga</span>
            <span>{format(new Date(invoice.dischargeDate), 'dd/MM/yyyy HH:mm')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Litros facturados</span>
            <span className="font-medium">{invoiceLiters.toLocaleString()} L</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Costo por litro</span>
            <span>{invoice.currency.symbol} {parseFloat(invoice.costPerLiter).toFixed(4)}</span>
          </div>
          <div className="flex justify-between col-span-2 border-t pt-3 font-medium">
            <span>Monto total</span>
            <span>{invoice.currency.symbol} {parseFloat(invoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Recepciones de despacho */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Recepciones de despacho ({invoice.dispatchReceptions?.length ?? 0})
            </CardTitle>
            <div className="text-sm text-right">
              <span className="text-muted-foreground">Total recibido: </span>
              <span className="font-medium">{totalReceived.toLocaleString()} L</span>
              {variance !== 0 && (
                <span className={`ml-2 text-xs ${variance > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                  ({variance > 0 ? '+' : ''}{variance.toLocaleString(undefined, { maximumFractionDigits: 2 })} L varianza)
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!invoice.dispatchReceptions?.length ? (
            <p className="text-sm text-muted-foreground">No se han registrado recepciones para esta factura.</p>
          ) : (
            <div className="space-y-3">
              {invoice.dispatchReceptions.map((r: any, i: number) => (
                <div key={r.id} className="rounded-lg border p-4 text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Tanque: {r.tank.name}</span>
                    <span className="text-muted-foreground">{format(new Date(r.receptionDate), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <p className="text-muted-foreground uppercase tracking-wide font-medium">Litros recibidos</p>
                      <p className="text-base font-semibold">{parseFloat(r.receivedLiters).toLocaleString()} L</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground uppercase tracking-wide font-medium">Altura (cm)</p>
                      <p>{parseFloat(r.initialTankReadingCm).toLocaleString()} → {parseFloat(r.finalTankReadingCm).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground uppercase tracking-wide font-medium">Volumen tanque (L)</p>
                      <p>{parseFloat(r.initialTankVolumeLiters).toLocaleString()} → {parseFloat(r.finalTankVolumeLiters).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
