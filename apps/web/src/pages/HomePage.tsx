import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/shared/theme-toggle'

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold">FinanceAI</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Módulo 1 — Base da infraestrutura. Backend e frontend conectados via Nginx.
      </p>
      <Button asChild>
        <Link to="/health">Ver status da API</Link>
      </Button>
    </div>
  )
}
