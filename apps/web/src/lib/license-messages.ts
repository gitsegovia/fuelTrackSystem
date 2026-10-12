// Mensajes compartidos entre el banner (LicenseContext) y el enlace de errores de Apollo
// (apollo-client.ts), para que el toast de un error de licencia diga lo mismo que el banner.

export const LICENSE_READ_ONLY_MESSAGE =
  'Licencia vencida: el sistema está en solo lectura. Contacta a Core Code Innovation para renovar.'

export function licenseStationLimitMessage(maxStations: number | null): string {
  const n = maxStations ?? '—'
  return `Tu plan permite hasta ${n} estaciones. Para agregar más, cambia de plan con Core Code Innovation.`
}
