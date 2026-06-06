import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { QUERIES as ShiftQueries } from '@/services/graphql/gql/employeeShift'
import { QUERIES as DispenserQueries } from '@/services/graphql/gql/dispenser'
import { QUERIES as ReadingQueries, MUTATIONS as ReadingMutations } from '@/services/graphql/gql/dispenserReading'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function NewReadingsPage() {
  const { id: shiftId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const type = (searchParams.get('type') ?? 'INITIAL') as 'INITIAL' | 'FINAL'
  const navigate = useNavigate()

  const { data: shiftData } = useQuery<{ employeeShift: any }>(ShiftQueries.employeeShift, { variables: { id: shiftId }, skip: !shiftId })
  const shift = shiftData?.employeeShift
  const gasStationId = shift?.gasStationId ?? ''

  const { data: dispensersData, loading: loadingDispensers } = useQuery<{ dispensersByGasStation: any[] }>(
    DispenserQueries.dispensersByGasStation,
    { variables: { gasStationId }, skip: !gasStationId }
  )
  const { data: readingsData } = useQuery<{ dispenserReadingsByShift: any[] }>(ReadingQueries.dispenserReadingsByShift, {
    variables: { employeeShiftId: shiftId },
    skip: !shiftId,
  })

  const [createReading] = useMutation(ReadingMutations.createDispenserReading, {
    refetchQueries: [
      { query: ReadingQueries.dispenserReadingsByShift, variables: { employeeShiftId: shiftId } },
    ],
  })

  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const existingReadings: any[] = readingsData?.dispenserReadingsByShift ?? []
  const initialByNozzle = Object.fromEntries(
    existingReadings.filter((r) => r.readingType === 'INITIAL').map((r) => [r.dispenserNozzleId, r])
  )
  const recordedForType = new Set(
    existingReadings.filter((r) => r.readingType === type).map((r) => r.dispenserNozzleId)
  )

  const allDispensers: any[] = dispensersData?.dispensersByGasStation ?? []
  const nozzles = allDispensers.flatMap((d: any) =>
    (d.nozzles ?? [])
      .filter((n: any) => n.isOperational)
      .map((n: any) => ({ ...n, dispenserName: d.name }))
  )

  const pendingNozzles = nozzles.filter((n) => !recordedForType.has(n.id))
  const doneNozzles = nozzles.filter((n) => recordedForType.has(n.id))

  const allFilled = pendingNozzles.every((n) => {
    const val = parseFloat(values[n.id] ?? '')
    return !isNaN(val) && val >= 0
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allFilled) {
      toast.error('Completa la lectura de todas las boquillas.')
      return
    }

    if (type === 'FINAL') {
      for (const n of pendingNozzles) {
        const val = parseFloat(values[n.id] ?? '0')
        const initial = initialByNozzle[n.id]
        if (initial && val < parseFloat(initial.meterReading)) {
          toast.error(`La lectura final de "${n.dispenserName} — ${n.name}" debe ser ≥ ${parseFloat(initial.meterReading).toLocaleString()}.`)
          return
        }
      }
    }

    setSubmitting(true)
    try {
      for (const n of pendingNozzles) {
        await createReading({
          variables: {
            input: {
              dispenserNozzleId: n.id,
              employeeShiftId: shiftId,
              meterReading: parseFloat(values[n.id]),
              readingType: type,
              readingTime: new Date().toISOString(),
            },
          },
        })
      }
      toast.success(`Lecturas ${type === 'INITIAL' ? 'iniciales' : 'finales'} registradas.`)
      navigate(`/shifts/${shiftId}`)
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    } finally {
      setSubmitting(false)
    }
  }

  const title = type === 'INITIAL' ? 'Lecturas iniciales' : 'Lecturas finales'
  const subtitle = shift ? `${shift.employee.firstName} ${shift.employee.lastName} · ${shift.gasStation.name}` : ''

  if (loadingDispensers) return <Skeleton className="h-64 w-full max-w-lg" />

  if (nozzles.length === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <PageHeader title={title} description={subtitle}
          action={<Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="size-4" /> Volver</Button>}
        />
        <p className="text-sm text-muted-foreground">No hay boquillas operativas en esta estación.</p>
      </div>
    )
  }

  if (pendingNozzles.length === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <PageHeader title={title} description={subtitle}
          action={<Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="size-4" /> Volver</Button>}
        />
        <p className="text-sm text-green-600 font-medium">✓ Todas las lecturas {type === 'INITIAL' ? 'iniciales' : 'finales'} ya están registradas.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Volver al turno</Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader
        title={title}
        description={subtitle}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {doneNozzles.length > 0 && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ya registradas</p>
          {doneNozzles.map((n) => {
            const existing = existingReadings.find((r) => r.dispenserNozzleId === n.id && r.readingType === type)
            return (
              <div key={n.id} className="flex justify-between text-muted-foreground">
                <span>{n.dispenserName} — {n.name}</span>
                <span className="font-medium text-foreground">{parseFloat(existing?.meterReading ?? '0').toLocaleString()} L</span>
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {pendingNozzles.map((n) => {
          const initial = initialByNozzle[n.id]
          const inputVal = values[n.id] ?? ''
          const parsedInput = parseFloat(inputVal)
          const diff = type === 'FINAL' && initial && !isNaN(parsedInput)
            ? parsedInput - parseFloat(initial.meterReading)
            : null

          return (
            <Card key={n.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{n.dispenserName} — {n.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Lectura en sistema</p>
                    <p className="font-medium">{parseFloat(n.currentMeterReading ?? '0').toLocaleString()} L</p>
                  </div>
                  {type === 'FINAL' && initial && (
                    <div>
                      <p className="text-xs text-muted-foreground">Lectura inicial del turno</p>
                      <p className="font-medium">{parseFloat(initial.meterReading).toLocaleString()} L</p>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Lectura {type === 'INITIAL' ? 'inicial' : 'final'} *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={inputVal}
                    onChange={(e) => setValues((prev) => ({ ...prev, [n.id]: e.target.value }))}
                  />
                </div>
                {diff !== null && diff >= 0 && (
                  <p className="text-xs text-amber-600 font-medium">
                    Diferencia: {diff.toLocaleString(undefined, { minimumFractionDigits: 2 })} L despachados en turno
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}

        <Button type="submit" className="w-full" disabled={submitting || !allFilled}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Confirmar lecturas ({pendingNozzles.length} boquilla{pendingNozzles.length !== 1 ? 's' : ''})
        </Button>
      </form>
    </div>
  )
}
