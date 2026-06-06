'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { ArrowLeft } from 'lucide-react'
import { QUERIES as TankQueries } from '@/services/graphql/gql/tank'
import { QUERIES as ReceptionQueries } from '@/services/graphql/gql/dispatchReception'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'

const FUEL_KIND_LABELS: Record<string, string> = {
  GASOLINE_91: 'Gasolina 91',
  GASOLINE_95: 'Gasolina 95',
  DIESEL: 'Diésel',
  KEROSENE: 'Kerosene',
}

export default function TankReceptionsPage() {
  const { id: gasStationId, tankId } = useParams<{ id: string; tankId: string }>()
  const router = useRouter()

  const { data: tankData } = useQuery<{ tank: any }>(TankQueries.tank, { variables: { id: tankId }, skip: !tankId })
  const { data, loading } = useQuery<{ dispatchReceptionsByTank: any[] }>(ReceptionQueries.dispatchReceptionsByTank, {
    variables: { tankId },
    skip: !tankId,
  })

  const receptions: any[] = data?.dispatchReceptionsByTank ?? []
  const tank = tankData?.tank

  const totalReceived = receptions.reduce((s, r) => s + parseFloat(r.receivedLiters), 0)

  if (loading) return <Skeleton className="h-64 w-full max-w-3xl" />

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={`Historial de despachos — ${tank?.name ?? ''}`}
        description={`${tank?.fuelType?.name ?? ''} · Cap. máx: ${tank ? parseFloat(tank.maxCapacityLiters).toLocaleString() : ''} L`}
        action={
          <Button variant="outline" size="sm" onClick={() => router.push(`/admin/gas-stations/${gasStationId}/equipment`)}>
            <ArrowLeft className="size-4" /> Volver al equipamiento
          </Button>
        }
      />

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border px-4 py-3 space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Recepciones</p>
          <p className="text-2xl font-bold">{receptions.length}</p>
        </div>
        <div className="rounded-lg border px-4 py-3 space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Total recibido</p>
          <p className="text-2xl font-bold">{totalReceived.toLocaleString()} L</p>
        </div>
        <div className="rounded-lg border px-4 py-3 space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Volumen actual</p>
          <p className="text-2xl font-bold">
            {tank?.currentVolumeLiters ? parseFloat(tank.currentVolumeLiters).toLocaleString() : '—'} L
          </p>
        </div>
      </div>

      {/* Lista de recepciones */}
      {receptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este tanque no tiene recepciones de despacho registradas.</p>
      ) : (
        <div className="space-y-3">
          {receptions.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      Factura {r.invoice?.invoiceNumber}
                      {r.invoice?.fuelKind && (
                        <span className="ml-2 text-muted-foreground font-normal">
                          · {FUEL_KIND_LABELS[r.invoice.fuelKind] ?? r.invoice.fuelKind}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(r.receptionDate), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/admin/invoices/${r.invoiceId}`)}
                  >
                    Ver factura
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs border-t pt-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground uppercase tracking-wide font-medium">Recibido</p>
                    <p className="text-sm font-semibold">{parseFloat(r.receivedLiters).toLocaleString()} L</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground uppercase tracking-wide font-medium">Altura (cm)</p>
                    <p>{parseFloat(r.initialTankReadingCm).toLocaleString()} → {parseFloat(r.finalTankReadingCm).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground uppercase tracking-wide font-medium">Volumen (L)</p>
                    <p>{parseFloat(r.initialTankVolumeLiters).toLocaleString()} → {parseFloat(r.finalTankVolumeLiters).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
