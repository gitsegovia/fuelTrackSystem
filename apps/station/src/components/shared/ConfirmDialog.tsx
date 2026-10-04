import type { ReactNode } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
  /** Acción adicional entre Cancelar y Confirmar (ej. "Ver operaciones") */
  extraAction?: { label: string; onClick: () => void }
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  extraAction,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-lg outline-none">
          <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground" render={<div />}>
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <AlertDialog.Close render={<Button variant="outline" size="sm" />}>Cancelar</AlertDialog.Close>
            {extraAction && (
              <Button variant="secondary" size="sm" onClick={extraAction.onClick}>
                {extraAction.label}
              </Button>
            )}
            <Button variant={destructive ? 'destructive' : 'default'} size="sm" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
