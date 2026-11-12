'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { canAccessRoute } from '@/lib/permissions'
import { adminNavGroups } from '@/lib/admin-nav'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { BrandMark } from '@/components/shared/BrandMark'

// T-076: drawer de navegación para debajo de md — reutiliza adminNavGroups (misma lista
// que AdminSidebar) en vez de duplicarla. El admin tiene ~12 secciones, por eso drawer y no
// barra inferior (a diferencia del panel estación, T-069).
export function AdminMobileNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="data-[side=left]:w-[280px] bg-sidebar text-sidebar-foreground border-sidebar-border p-0 gap-0 flex flex-col"
        >
          <SheetHeader className="px-5 py-5">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <SheetDescription className="sr-only">Menú de navegación del panel admin</SheetDescription>
            <BrandMark size={32} onDark textClassName="text-base" />
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4 space-y-4 scrollbar-thin">
            {adminNavGroups.map((group, i) => {
              const items = group.items.filter(({ href }) => canAccessRoute(user, href))
              if (items.length === 0) return null
              return (
                <div key={i} className="space-y-0.5">
                  {group.label && (
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                      {group.label}
                    </p>
                  )}
                  {items.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {label}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
