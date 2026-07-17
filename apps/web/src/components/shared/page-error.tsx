import { AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface PageErrorProps {
  message?: string
  onRetry: () => void
}

/** Estado de erro padrão de página: ícone, mensagem e botão de retry. */
export function PageError({
  message = 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.',
  onRetry,
}: PageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <AlertCircle className="text-muted-foreground size-6" aria-hidden />
      </div>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" />
        Tentar novamente
      </Button>
    </div>
  )
}
