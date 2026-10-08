// Mismos umbrales que cci-licensing/src/lifecycle/lifecycle.ts (computeStatus), para que el
// estado que calcula FuelTrack sin red coincida con el que calcularía el servidor.
export type LicenseStatus = "ACTIVE" | "DUE_SOON" | "GRACE" | "READ_ONLY";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

export function graceEndsAt(expiresAt: Date, graceDays: number): Date {
  return new Date(expiresAt.getTime() + graceDays * DAY_MS);
}

// ACTIVE (faltan > 7 días) → DUE_SOON (≤ 7 días para vencer) → GRACE (venció hace ≤ graceDays) →
// READ_ONLY (venció la gracia).
export function computeStatus(expiresAt: Date, graceDays: number, now: Date): LicenseStatus {
  const days = daysUntil(expiresAt, now);
  if (days > 7) return "ACTIVE";
  if (days >= 0) return "DUE_SOON";
  return now <= graceEndsAt(expiresAt, graceDays) ? "GRACE" : "READ_ONLY";
}
