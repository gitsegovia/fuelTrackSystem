import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Gauge } from 'lucide-react'

export default function StationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary">
              <Gauge className="size-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle>Panel de Estación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El panel operativo de estación estará disponible próximamente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
