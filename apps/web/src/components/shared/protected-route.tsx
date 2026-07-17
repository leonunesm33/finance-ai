import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { refreshSession } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)

  // Ao carregar a app com usuário persistido mas sem access token em memória,
  // tenta um refresh silencioso (cookie httpOnly) antes de decidir redirecionar.
  const [restoring, setRestoring] = useState(() => !accessToken && Boolean(user))

  useEffect(() => {
    if (!restoring) return
    let active = true
    refreshSession().finally(() => {
      if (active) setRestoring(false)
    })
    return () => {
      active = false
    }
  }, [restoring])

  if (restoring) {
    return (
      <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
        Restaurando sessão...
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
