// Mismos umbrales que cci-licensing/src/lifecycle/lifecycle.ts (computeStatus), para que el
// estado que calcula FuelTrack sin red coincida con el que calcularía el servidor.
export type LicenseStatus = "ACTIVE" | "DUE_SOON" | "GRACE" | "READ_ONLY";

const DAY_MS = 24 * 60 * 60 * 1000;
// Un reloj local desfasado más de un día del punto más alto ya visto se reporta (T-053); no se
// castiga un desfase chico (relojes que no están sincronizados al segundo).
const CLOCK_SKEW_THRESHOLD_MS = DAY_MS;

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

// T-053: atrasar el reloj del servidor y cortar la red hacia CCI Licencias no debe rejuvenecer la
// licencia. `maxSeenAt` es la hora más alta vista hasta ahora (de serverTime, de issuedAt y del
// propio reloj local en cada chequeo); nunca retrocede, así que calcular con max(local, maxSeenAt)
// hace que un reloj atrasado después de un avance ya visto no tenga efecto.
export function maxDate(...dates: Array<Date | null | undefined>): Date {
  return dates.reduce<Date>((acc, d) => (d && d.getTime() > acc.getTime() ? d : acc), new Date(0));
}

export function effectiveNow(localNow: Date, maxSeenAt: Date | null | undefined): Date {
  return maxDate(localNow, maxSeenAt);
}

// Reloj local sospechosamente atrasado respecto a la última hora confiable vista: se informa
// (clockSkewDetected), no se bloquea por esto solo.
export function isClockSkewed(localNow: Date, maxSeenAt: Date | null | undefined): boolean {
  const seen = maxSeenAt ?? new Date(0);
  return seen.getTime() - localNow.getTime() > CLOCK_SKEW_THRESHOLD_MS;
}
