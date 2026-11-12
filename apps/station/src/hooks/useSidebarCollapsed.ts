import { useCallback, useState } from 'react'

const KEY = 'estacion360.sidebar.collapsed'

/** Estado plegado/expandido del sidebar, recordado en localStorage (inicial: expandido). */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    try {
      localStorage.setItem(KEY, value ? '1' : '0')
    } catch {
      /* sin almacenamiento: el estado vale solo en esta sesión */
    }
  }, [])

  return [collapsed, setCollapsed] as const
}
