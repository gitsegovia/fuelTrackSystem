import type { AuthUser } from '@/types/auth'

// Espejo de apps/api/src/authz (T-042) y de la matriz 00-sistema/Matriz de permisos (ADR-016).
// La API es la que decide; esto solo evita mostrar acciones que el servidor va a rechazar.
export type Profile = 'ADMIN' | 'GERENTE' | 'SUPERVISOR' | 'CAJERO' | 'BOMBERO' | 'ADMINISTRATIVO'

export type Capability =
  | 'openOwnShift'
  | 'closeOtherShift'
  | 'recordReadings'
  | 'emitTicket'
  | 'payTicket'
  | 'dispatchTicket'
  | 'cancelTicket'
  | 'refundTicket'
  | 'measureTank'
  | 'viewDifferential'

const OPERATIVE: Profile[] = ['ADMIN', 'GERENTE', 'SUPERVISOR', 'CAJERO']

const CAPABILITY_PROFILES: Record<Capability, Profile[]> = {
  openOwnShift: [...OPERATIVE, 'BOMBERO'], // matriz fila 6
  closeOtherShift: ['ADMIN', 'GERENTE', 'SUPERVISOR'], // fila 7
  recordReadings: OPERATIVE, // fila 8
  emitTicket: OPERATIVE, // fila 9
  payTicket: OPERATIVE, // fila 10
  dispatchTicket: [...OPERATIVE, 'BOMBERO'], // fila 11
  cancelTicket: ['ADMIN', 'GERENTE', 'SUPERVISOR'], // fila 12
  refundTicket: OPERATIVE, // fila 13
  measureTank: ['ADMIN', 'GERENTE', 'SUPERVISOR', 'BOMBERO'], // fila 14
  viewDifferential: ['ADMIN', 'GERENTE', 'SUPERVISOR', 'ADMINISTRATIVO', 'BOMBERO'], // fila 19 (bombero: solo el suyo)
}

export function profileOf(user: Pick<AuthUser, 'role' | 'userType'>): Profile | null {
  if (user.role === 'ADMIN') return 'ADMIN'
  if (user.role === 'MANAGER') return 'GERENTE'
  switch (user.userType) {
    case 'Administrator':
      return 'ADMIN'
    case 'Supervisor':
      return 'SUPERVISOR'
    case 'Cashier':
      return 'CAJERO'
    case 'FuelAttendant':
      return 'BOMBERO'
    case 'Administrative':
      return 'ADMINISTRATIVO'
  }
}

export function can(user: AuthUser | null | undefined, capability: Capability): boolean {
  if (!user) return false
  const profile = profileOf(user)
  return profile !== null && CAPABILITY_PROFILES[capability].includes(profile)
}
