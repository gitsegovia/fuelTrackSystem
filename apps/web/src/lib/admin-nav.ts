import {
  LayoutDashboard, Building2, Fuel, Users, Droplets, Database, HardHat, Coins, Tag,
  FileText, ShieldCheck, CreditCard, type LucideIcon,
} from 'lucide-react'

export interface AdminNavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface AdminNavGroup {
  label: string | null
  items: AdminNavItem[]
}

// T-076: lista única de navegación del panel admin — la usan AdminSidebar (escritorio) y
// AdminMobileNav (drawer en móvil), para no duplicarla.
export const adminNavGroups: AdminNavGroup[] = [
  {
    label: null,
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { href: '/admin/companies', label: 'Empresas', icon: Building2 },
      { href: '/admin/gas-stations', label: 'Estaciones', icon: Fuel },
      { href: '/admin/fuel-types', label: 'Combustibles', icon: Droplets },
      { href: '/admin/tank-models', label: 'Modelos de Tanque', icon: Database },
      { href: '/admin/users', label: 'Usuarios', icon: Users },
      { href: '/admin/employees', label: 'Empleados', icon: HardHat },
      { href: '/admin/currencies', label: 'Monedas', icon: Coins },
      { href: '/admin/sale-type-configs', label: 'Tipos de venta', icon: Tag },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/admin/invoices', label: 'Facturas', icon: FileText },
      { href: '/admin/invoice-payments', label: 'Pagos de Facturas', icon: CreditCard },
    ],
  },
  {
    label: 'Auditoría',
    items: [
      { href: '/admin/audit', label: 'Auditoría', icon: ShieldCheck },
    ],
  },
]
