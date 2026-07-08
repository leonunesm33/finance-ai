import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'

export function HomePage() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">
        {user ? `Olá, ${user.name.split(' ')[0]}!` : 'FinanceAI'}
      </h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Módulo 2 — Autenticação concluída. O dashboard consolidado chega no Módulo 5.
      </p>
      <Button asChild>
        <Link to="/health">Ver status da API</Link>
      </Button>
    </div>
  )
}
