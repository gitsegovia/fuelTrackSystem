// Espejo de la matriz de permisos (ADR-016, T-042). La API es la autoridad: esto solo
// decide qué se muestra. Alcance: role ADMIN = empresa; el resto = su estación.
import type { AuthUser } from '@/types/auth'

export const isAdminRole = (u: AuthUser | null | undefined) => u?.role === 'ADMIN'
export const isManagerRole = (u: AuthUser | null | undefined) => u?.role === 'MANAGER'
export const isAdministrativeCargo = (u: AuthUser | null | undefined) => u?.userType === 'Administrative'

// Acceso al panel admin: ADMIN, MANAGER (acotado a su estación) y cargo Administrativo.
export const canAccessAdminPanel = (u: AuthUser | null | undefined) =>
  isAdminRole(u) || isManagerRole(u) || isAdministrativeCargo(u)

// Alcance por estación (no empresa): todo el que no es ADMIN.
export const isStationScoped = (u: AuthUser | null | undefined) => !isAdminRole(u)

// Catálogos y equipamiento (combustibles, modelos de tanque, estaciones, islas, tanques): solo ADMIN escribe.
export const canManageCatalogs = (u: AuthUser | null | undefined) => isAdminRole(u)

// Tipos de venta y precios: ADMIN y GERENTE de su estación.
export const canManageSaleTypes = (u: AuthUser | null | undefined) => isAdminRole(u) || isManagerRole(u)

// Usuarios y empleados: ADMIN y GERENTE (el gerente no crea ADMIN ni MANAGER).
export const canManagePeople = (u: AuthUser | null | undefined) => isAdminRole(u) || isManagerRole(u)

// Empresas: solo ADMIN.
export const canViewCompanies = (u: AuthUser | null | undefined) => isAdminRole(u)

// Tasa de cambio (edición de moneda): ADMIN, GERENTE y Administrativo.
export const canEditCurrencyRate = (u: AuthUser | null | undefined) => canAccessAdminPanel(u)

// Facturas de proveedor: ADMIN, GERENTE y Administrativo escriben.
export const canManageInvoices = (u: AuthUser | null | undefined) => canAccessAdminPanel(u)

// Pagos a proveedor: ADMIN y Administrativo (el gerente solo ve).
export const canManageInvoicePayments = (u: AuthUser | null | undefined) =>
  isAdminRole(u) || isAdministrativeCargo(u)

// Cierre de período: ADMIN, GERENTE y Administrativo. Borrar: solo ADMIN.
export const canCloseAuditPeriod = (u: AuthUser | null | undefined) => canAccessAdminPanel(u)
export const canDeleteAuditPeriod = (u: AuthUser | null | undefined) => isAdminRole(u)

// Rutas del panel que requieren un permiso concreto (además de canAccessAdminPanel).
export const routePermissions: { prefix: string; allow: (u: AuthUser | null | undefined) => boolean }[] = [
  { prefix: '/admin/companies', allow: canViewCompanies },
  { prefix: '/admin/users', allow: canManagePeople },
  { prefix: '/admin/employees', allow: canManagePeople },
]

export function canAccessRoute(u: AuthUser | null | undefined, pathname: string): boolean {
  const rule = routePermissions.find((r) => pathname.startsWith(r.prefix))
  return rule ? rule.allow(u) : true
}
