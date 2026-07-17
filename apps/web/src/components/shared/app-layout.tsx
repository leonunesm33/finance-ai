import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Eye, EyeOff, Menu, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useCurrentUser } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { usePrivacyStore } from '@/stores/usePrivacyStore'

import { CommandPalette } from './command-palette'
import { NAV_ITEMS } from './nav-items'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary before:bg-primary before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { hidden, toggle } = usePrivacyStore()
  useCurrentUser()

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'bg-card hidden border-r transition-all duration-200 md:flex md:flex-col',
          collapsed ? 'md:w-16' : 'md:w-56',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Wallet className="text-primary size-5 shrink-0" />
          {!collapsed && (
            <span className="font-display text-lg font-medium tracking-tight">FinanceAI</span>
          )}
        </div>
        <Sidebar collapsed={collapsed} />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="font-display flex h-14 items-center gap-2 border-b px-4 text-lg font-medium tracking-tight">
            <Wallet className="text-primary size-5 shrink-0" />
            FinanceAI
          </SheetTitle>
          {/* onNavigate fecha o Sheet ao ativar um link, inclusive via teclado. */}
          <Sidebar collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="Recolher menu"
            onClick={() => setCollapsed((value) => !value)}
          >
            <Menu className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-4" />
          </Button>

          <span className="font-display font-medium tracking-tight md:hidden">FinanceAI</span>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
            onClick={toggle}
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <ThemeToggle />
          <UserMenu />
        </header>

        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}
