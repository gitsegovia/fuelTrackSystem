import { AuthenticatedUser } from "../interfaces";
import { UserRole } from "../utils/types";

export function isAuthenticated(user: AuthenticatedUser | undefined): void {
  if (!user) {
    throw new Error("Authentication requiered.");
  }
}

export function hasRole(
  user: AuthenticatedUser | undefined,
  requiredRole: UserRole
): void {
  isAuthenticated(user);
  if (user!.role !== requiredRole) {
    throw new Error("Forbidden: Role not valid");
  }
}

export function hasAnyRole(
  user: AuthenticatedUser | undefined,
  requiredRole: UserRole[]
): void {
  isAuthenticated(user);
  if (!requiredRole.includes(user!.role)) {
    throw new Error("Forbidden: Role not valid");
  }
}
