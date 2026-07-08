import { useEffect, useRef, useState } from 'react'
import { LogOut, User as UserIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/authStore'

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function UserMenu() {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        className="gap-2 px-2"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar className="size-7">
          <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
          <AvatarFallback>{getInitials(user.name) || <UserIcon className="size-4" />}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
      </Button>

      {open && (
        <div
          role="menu"
          className="bg-popover text-popover-foreground absolute right-0 z-50 mt-2 w-48 rounded-md border p-1 shadow-md"
        >
          <div className="px-2 py-1.5 text-sm">
            <p className="font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          </div>
          <div className="bg-border my-1 h-px" />
          <button
            role="menuitem"
            className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
