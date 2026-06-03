export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

export type UserType =
  | 'Administrator'
  | 'Supervisor'
  | 'Cashier'
  | 'FuelAttendant'
  | 'Administrative'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  userType: UserType
  company: {
    id: string
    name: string
  }
}

export interface LoginParams {
  username: string
  password: string
}

export type ErrCallbackType = (err: unknown) => void

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (params: LoginParams, errorCallback?: ErrCallbackType) => Promise<void>
  logout: () => void
}
