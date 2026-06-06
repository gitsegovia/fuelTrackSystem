import { PageHeader } from '@/components/shared/PageHeader'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen operacional de la estación"
      />
      <div className="rounded-xl border bg-muted/30 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">Página en migración desde apps/web</p>
      </div>
    </div>
  )
}
