'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS } from '@/services/graphql/gql/dispatchReception'
import { QUERIES as InvoiceQueries } from '@/services/graphql/gql/invoice'
import { QUERIES as TankQueries } from '@/services/graphql/gql/tank'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeSelect } from '@/components/shared/TimeSelect'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const decimal = (label: string) =>
  z.string().min(1, `${label} requerido`).refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
    `${label} debe ser un número válido`
  )

const schema = z.object({
  tankId: z.string().min(1, 'Selecciona un tanque'),
  receivedLiters: decimal('Litros recibidos'),
  receptionDate: z.string().min(1, 'Requerido'),
  receptionTime: z.string().min(1, 'Requerido'),
  initialTankReadingCm: decimal('Lectura inicial'),
  finalTankReadingCm: decimal('Lectura final'),
  initialTankVolumeLiters: decimal('Volumen inicial'),
  finalTankVolumeLiters: decimal('Volumen final'),
})
type FormData = z.infer<typeof schema>

export default function NewDispatchReceptionPage() {
  const { id: invoiceId } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: invoiceData, loading: fetchingInvoice } = useQuery<{ invoice: any }>(
    InvoiceQueries.invoice,
    { variables: { id: invoiceId }, skip: !invoiceId }
  )
  const { data: tanksData } = useQuery<{ tanksByGasStation: { id: string; name: string }[] }>(
    TankQueries.tanksByGasStation,
    {
      variables: { gasStationId: invoiceData?.invoice?.receivingGasStation?.id },
      skip: !invoiceData?.invoice?.receivingGasStation?.id,
    }
  )
  const [create, { loading }] = useMutation(MUTATIONS.createDispatchReception, {
    refetchQueries: [
      { query: InvoiceQueries.invoice, variables: { id: invoiceId } },
      { query: InvoiceQueries.invoices },
    ],
  })

  const now = new Date()
  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      receptionDate: now.toISOString().slice(0, 10),
      receptionTime: `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0')}`,
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const { receptionTime, ...rest } = data
      await create({
        variables: {
          input: {
            invoiceId,
            tankId: rest.tankId,
            receivedLiters: parseFloat(rest.receivedLiters),
            receptionDate: new Date(`${rest.receptionDate}T${receptionTime}`).toISOString(),
            initialTankReadingCm: parseFloat(rest.initialTankReadingCm),
            finalTankReadingCm: parseFloat(rest.finalTankReadingCm),
            initialTankVolumeLiters: parseFloat(rest.initialTankVolumeLiters),
            finalTankVolumeLiters: parseFloat(rest.finalTankVolumeLiters),
          },
        },
      })
      toast.success('Recepción de despacho registrada.')
      router.push('/admin/invoices')
    } catch (err: any) {
      toast.error(`Error al registrar: ${err.message ?? ''}`)
    }
  }

  if (fetchingInvoice) return <Skeleton className="h-64 w-full max-w-lg" />

  const invoice = invoiceData?.invoice
  const totalLiters = invoice ? parseFloat(invoice.liters) : 0
  const receivedLiters = invoice
    ? (invoice.dispatchReceptions ?? []).reduce((s: number, r: any) => s + parseFloat(r.receivedLiters), 0)
    : 0
  const remainingLiters = totalLiters - receivedLiters
  const isClosed = invoice?.status === 'CLOSED'
  const isComplete = remainingLiters <= 0
  const blocked = isClosed || isComplete

  const enteredLiters = parseFloat(watch('receivedLiters') || '0')
  const variance = isNaN(enteredLiters) ? 0 : enteredLiters - remainingLiters
  const showVarianceWarning = !isNaN(enteredLiters) && enteredLiters > 0 && variance > 0

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title="Registrar recepción de despacho"
        description={invoice ? `Factura ${invoice.invoiceNumber} — ${invoice.receivingGasStation.name}` : ''}
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {invoice && (
        <div className={`rounded-lg border px-4 py-3 text-sm space-y-2 ${isClosed ? 'bg-muted border-muted-foreground/20' : 'bg-muted/30'}`}>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            <span className={`font-medium ${isClosed ? 'text-muted-foreground' : 'text-primary'}`}>
              {isClosed ? 'Cerrada' : 'Pendiente'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Litros facturados</span>
            <span>{totalLiters.toLocaleString()} L</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ya recibidos</span>
            <span>{receivedLiters.toLocaleString()} L</span>
          </div>
          <div className="flex justify-between font-medium border-t pt-2">
            <span>Pendiente de recibir</span>
            <span className={remainingLiters <= 0 ? 'text-muted-foreground' : 'text-primary'}>
              {remainingLiters.toLocaleString()} L
            </span>
          </div>
          {isClosed && (
            <p className="text-xs text-muted-foreground pt-1">Esta factura está cerrada. No se pueden registrar más recepciones.</p>
          )}
          {!isClosed && isComplete && (
            <p className="text-xs text-muted-foreground pt-1">Los litros de esta factura ya están completos.</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-disabled={blocked}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Destino</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tanque receptor *</Label>
              <select {...register('tankId')} className={selectClass}>
                <option value="">Seleccionar tanque...</option>
                {tanksData?.tanksByGasStation?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {errors.tankId && <p className="text-xs text-destructive">{errors.tankId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha y hora de recepción *</Label>
              <div className="flex items-center gap-2">
                <Input type="date" {...register('receptionDate')} aria-invalid={!!errors.receptionDate} className="flex-1" />
                <Controller
                  name="receptionTime"
                  control={control}
                  render={({ field }) => (
                    <TimeSelect value={field.value} onChange={field.onChange} aria-invalid={!!errors.receptionTime} />
                  )}
                />
              </div>
              {(errors.receptionDate || errors.receptionTime) && (
                <p className="text-xs text-destructive">Fecha y hora requeridas</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Litros recibidos *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('receivedLiters')} aria-invalid={!!errors.receivedLiters} />
              {errors.receivedLiters && <p className="text-xs text-destructive">{errors.receivedLiters.message}</p>}
              {showVarianceWarning && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Excede los litros pendientes en {variance.toLocaleString(undefined, { maximumFractionDigits: 2 })} L — se registrará como excedente de despacho.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Lecturas del tanque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Altura inicial (cm) *</Label>
                <Input type="number" step="0.1" placeholder="0.0" {...register('initialTankReadingCm')} aria-invalid={!!errors.initialTankReadingCm} />
                {errors.initialTankReadingCm && <p className="text-xs text-destructive">{errors.initialTankReadingCm.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Altura final (cm) *</Label>
                <Input type="number" step="0.1" placeholder="0.0" {...register('finalTankReadingCm')} aria-invalid={!!errors.finalTankReadingCm} />
                {errors.finalTankReadingCm && <p className="text-xs text-destructive">{errors.finalTankReadingCm.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Volumen inicial (L) *</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('initialTankVolumeLiters')} aria-invalid={!!errors.initialTankVolumeLiters} />
                {errors.initialTankVolumeLiters && <p className="text-xs text-destructive">{errors.initialTankVolumeLiters.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Volumen final (L) *</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('finalTankVolumeLiters')} aria-invalid={!!errors.finalTankVolumeLiters} />
                {errors.finalTankVolumeLiters && <p className="text-xs text-destructive">{errors.finalTankVolumeLiters.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading || blocked}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Guardando...' : 'Registrar recepción'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}
