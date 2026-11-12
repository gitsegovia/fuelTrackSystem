import type * as React from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

/** Tooltip lateral mínimo sobre @base-ui. `children` es el elemento disparador (Link, button…). */
export function SideTooltip({
  label,
  disabled = false,
  side = 'right',
  children,
}: {
  label: string
  disabled?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactElement
}) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={10} className="z-50">
          <TooltipPrimitive.Popup className="rounded-md bg-[#0B2238] px-2.5 py-1.5 text-xs font-medium text-white shadow-md ring-1 ring-[#163B5C]">
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export const TooltipProvider = TooltipPrimitive.Provider
