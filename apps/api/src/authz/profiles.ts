import { UserRole, UserType } from "../utils/types";

// Perfiles de la matriz (00-sistema/Matriz de permisos). El rol MANAGER es la columna Gerente;
// un EMPLOYEE toma el perfil de su cargo. Administrador con rol EMPLOYEE opera con el perfil ADMIN
// pero dentro de su estación (el alcance sale del rol, no del cargo).
export enum Profile {
  ADMIN = "ADMIN",
  GERENTE = "GERENTE",
  SUPERVISOR = "SUPERVISOR",
  CAJERO = "CAJERO",
  BOMBERO = "BOMBERO",
  ADMINISTRATIVO = "ADMINISTRATIVO",
}

const BY_USER_TYPE: Partial<Record<UserType, Profile>> = {
  [UserType.ADMINISTRATOR]: Profile.ADMIN,
  [UserType.SUPERVISOR]: Profile.SUPERVISOR,
  [UserType.CASHIER]: Profile.CAJERO,
  [UserType.FUEL_ATTENDANT]: Profile.BOMBERO,
  [UserType.ADMINISTRATIVE]: Profile.ADMINISTRATIVO,
};

export function profileOf(role: UserRole, userType: UserType): Profile | undefined {
  if (role === UserRole.ADMIN) return Profile.ADMIN;
  if (role === UserRole.MANAGER) return Profile.GERENTE;
  return BY_USER_TYPE[userType];
}
