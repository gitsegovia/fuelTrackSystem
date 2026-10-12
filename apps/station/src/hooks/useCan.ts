import { useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLicense } from '@/context/LicenseContext'
import { can, isWriteCapability, type Capability } from '@/lib/permissions'

/** Permiso por cargo (ADR-016) y, para las escrituras, licencia no vencida (T-052). */
export function useCan() {
  const { user } = useAuth()
  const { readOnly } = useLicense()
  return useCallback(
    (capability: Capability) => can(user, capability) && !(readOnly && isWriteCapability(capability)),
    [user, readOnly]
  )
}
