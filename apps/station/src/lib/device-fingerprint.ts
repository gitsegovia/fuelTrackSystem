const DEVICE_KEY = 'ft-device-id'
const USER_KEY   = 'ft-user-id'

/**
 * Devuelve un UUID estable para este navegador/dispositivo.
 * Se genera una sola vez y se persiste en localStorage.
 * Si el usuario limpia el storage se regenera — aceptable para MVP.
 */
export function getDeviceFingerprint(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function getStoredUserId(): string {
  return localStorage.getItem(USER_KEY) ?? 'unknown'
}

export function setStoredUserId(id: string): void {
  localStorage.setItem(USER_KEY, id)
}

export function clearStoredUserId(): void {
  localStorage.removeItem(USER_KEY)
}
