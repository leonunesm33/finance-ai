import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Skeletons reutilizáveis de página. Cada um espelha as dimensões do
 * elemento real correspondente para evitar layout shift ao carregar.
 */

/** Espelha o StatCard do dashboard: título pequeno + valor text-2xl (h-8). */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="size-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-28" />
      </CardContent>
    </Card>
  )
}

/** Lista de n linhas no padrão das listas de transações/contas (py-3 + border-b). */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between border-b py-3 last:border-0">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

/** Card de gráfico: título + área do gráfico (h-72 por padrão, igual aos charts reais). */
export function ChartSkeleton({
  className,
  heightClassName = 'h-72',
}: {
  className?: string
  heightClassName?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className={heightClassName}>
        <Skeleton className="size-full" />
      </CardContent>
    </Card>
  )
}
