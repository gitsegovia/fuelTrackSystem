'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Download, Upload, Trash2, Loader2 } from 'lucide-react'
import { QUERIES as TankModelQueries } from '@/services/graphql/gql/tankModel'
import { QUERIES as CalibrationQueries, MUTATIONS as CalibrationMutations } from '@/services/graphql/gql/tankCalibrationEntry'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const CSV_TEMPLATE = `heightCm,volumeLiters
0,0
10,95
20,210
30,345
40,495
50,660
60,835
70,1015
80,1195
90,1370
100,1530
`

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'calibracion_tanque_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): Array<{ heightCm: number; volumeLiters: number }> | null {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return null

  const header = lines[0].toLowerCase().replace(/\s/g, '')
  if (!header.includes('heightcm') || !header.includes('volumeliters')) return null

  const rows: Array<{ heightCm: number; volumeLiters: number }> = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const [h, v] = line.split(',')
    const heightCm = parseFloat(h)
    const volumeLiters = parseFloat(v)
    if (isNaN(heightCm) || isNaN(volumeLiters)) return null
    rows.push({ heightCm, volumeLiters })
  }
  return rows.length > 0 ? rows : null
}

export default function TankModelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<Array<{ heightCm: number; volumeLiters: number }> | null>(null)

  const { data: modelData, loading: loadingModel } = useQuery<{ tankModel: any }>(
    TankModelQueries.tankModel, { variables: { id }, skip: !id }
  )
  const { data: calData, loading: loadingCal, refetch } = useQuery<{ tankCalibrationEntriesByModel: any[] }>(
    CalibrationQueries.tankCalibrationEntriesByModel, { variables: { tankModelId: id }, skip: !id }
  )
  const [bulkCreate] = useMutation(CalibrationMutations.bulkCreateTankCalibrationEntries)
  const [deleteEntry] = useMutation(CalibrationMutations.deleteTankCalibrationEntry)

  const model = modelData?.tankModel
  const entries: any[] = calData?.tankCalibrationEntriesByModel ?? []

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (!parsed) {
        toast.error('Formato inválido. Revisa que el CSV tenga columnas heightCm y volumeLiters.')
        setPreview(null)
      } else {
        setPreview(parsed)
      }
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      await bulkCreate({
        variables: { tankModelId: id, entries: preview },
      })
      toast.success(`${preview.length} filas importadas correctamente. Las entradas anteriores fueron reemplazadas.`)
      setPreview(null)
      refetch()
    } catch (err: any) {
      toast.error(`Error al importar: ${err.message ?? ''}`)
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    try {
      await deleteEntry({ variables: { id: entryId } })
      toast.success('Entrada eliminada.')
      refetch()
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  if (loadingModel) return <Skeleton className="h-64 w-full max-w-3xl" />
  if (!model) return <p className="text-sm text-muted-foreground">Modelo no encontrado.</p>

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={model.name}
        description={`Capacidad nominal: ${parseFloat(model.nominalCapacity).toLocaleString()} L · ${model.shape}`}
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {/* Tabla de calibración */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Tabla de calibración
              </CardTitle>
              {entries.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entries.length} puntos · altura {parseFloat(entries[0].heightCm).toFixed(1)} – {parseFloat(entries[entries.length - 1].heightCm).toFixed(1)} cm
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" /> Descargar template
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Importar CSV
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Preview del CSV antes de confirmar */}
          {preview && (
            <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-800">
                  Vista previa — {preview.length} filas a importar
                </p>
                <p className="text-xs text-amber-600">
                  Esto reemplazará las {entries.length} entradas existentes.
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto rounded border bg-white text-xs font-mono">
                <div className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b font-semibold text-muted-foreground">
                  <span>Altura (cm)</span><span>Volumen (L)</span>
                </div>
                {preview.slice(0, 20).map((row, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 px-3 py-1 border-b last:border-0">
                    <span>{row.heightCm}</span><span>{row.volumeLiters}</span>
                  </div>
                ))}
                {preview.length > 20 && (
                  <p className="px-3 py-1.5 text-muted-foreground">... y {preview.length - 20} filas más</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  {importing && <Loader2 className="size-4 animate-spin" />}
                  Confirmar importación
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreview(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Tabla actual */}
          {loadingCal ? (
            <Skeleton className="h-32 w-full" />
          ) : entries.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Sin datos de calibración.</p>
              <p className="text-xs text-muted-foreground">
                Descarga el template CSV, complétalo con los datos del fabricante y súbelo.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b">
                <span>Altura (cm)</span>
                <span>Volumen (L)</span>
                <span></span>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y text-sm">
                {entries.map((e: any) => (
                  <div key={e.id} className="grid grid-cols-3 gap-2 px-4 py-2 items-center hover:bg-muted/20">
                    <span className="font-mono">{parseFloat(e.heightCm).toFixed(1)}</span>
                    <span className="font-mono">{parseFloat(e.volumeLiters).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(e.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info del modelo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Datos del modelo
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Forma</p>
            <p className="font-medium">{model.shape}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Capacidad nominal</p>
            <p className="font-medium">{parseFloat(model.nominalCapacity).toLocaleString()} L</p>
          </div>
          {model.lengthCm && (
            <div>
              <p className="text-xs text-muted-foreground">Longitud</p>
              <p className="font-medium">{model.lengthCm} cm</p>
            </div>
          )}
          {model.diameterCm && (
            <div>
              <p className="text-xs text-muted-foreground">Diámetro</p>
              <p className="font-medium">{model.diameterCm} cm</p>
            </div>
          )}
          {model.description && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Descripción</p>
              <p className="font-medium">{model.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
