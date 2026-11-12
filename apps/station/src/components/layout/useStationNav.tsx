import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Clock, Receipt, Droplets, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOffline } from '@/context/OfflineContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

export const navItems = [
  { to: '/dashboard', label: 'Dashboard',        short: 'Inicio',  icon: LayoutDashboard },
  { to: '/shifts',    label: 'Turnos',           short: 'Turnos',  icon: Clock           },
  { to: '/tickets',   label: 'Tickets de venta', short: 'Tickets', icon: Receipt         },
  { to: '/tanks',     label: 'Tanques',          short: 'Tanques', icon: Droplets        },
  { to: '/sync',      label: 'Sincronización',   short: 'Sync',    icon: RefreshCw       },
]

/** Insignia de pendientes/errores y cierre de sesión con aviso, compartidos por sidebar y barras móviles. */
export function useStationNav() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { pendingCount, failedCount } = useOffline()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const unsynced = pendingCount + failedCount

  const handleLogout = () => {
    if (unsynced > 0) {
      setConfirmLogout(true)
      return
    }
    logout()
  }

  const logoutDialog = (
    <ConfirmDialog
      open={confirmLogout}
      onOpenChange={setConfirmLogout}
      title="Hay operaciones sin sincronizar"
      description={
        <div className="space-y-2">
          <p>
            {pendingCount > 0 && `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
            {pendingCount > 0 && failedCount > 0 && ' y '}
            {failedCount > 0 && `${failedCount} con error`} en este dispositivo.
          </p>
          <p>
            No se borran al cerrar sesión: quedan guardadas aquí y se enviarán cuando haya conexión,
            aunque luego ingrese otro usuario. Se registran con los datos de quien las creó.
          </p>
        </div>
      }
      extraAction={{
        label: 'Ver operaciones',
        onClick: () => {
          setConfirmLogout(false)
          navigate('/sync')
        },
      }}
      confirmLabel="Cerrar sesión igualmente"
      destructive
      onConfirm={() => {
        setConfirmLogout(false)
        logout()
      }}
    />
  )

  return { unsynced, pendingCount, failedCount, handleLogout, logoutDialog }
}
