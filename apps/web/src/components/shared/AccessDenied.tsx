import { ShieldAlert } from 'lucide-react'

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Sin acceso a esta sección</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tu cargo o rol no tiene permiso para ver esta pantalla. Si crees que es un error, consulta con un administrador.
      </p>
    </div>
  )
}
