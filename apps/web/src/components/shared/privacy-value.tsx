import { cn, formatCurrency } from '@/lib/utils'
import { usePrivacyStore } from '@/stores/usePrivacyStore'

interface PrivacyValueProps {
  value: number
  currency?: string
  className?: string
}

/** Valor fixo exibido (borrado) quando o modo privacidade está ativo. */
const PLACEHOLDER_VALUE = 1234.56

export function PrivacyValue({ value, currency = 'BRL', className }: PrivacyValueProps) {
  const hidden = usePrivacyStore((state) => state.hidden)

  return (
    <span
      className={cn('tnum transition-[filter] duration-300', hidden && 'blur-sm select-none', className)}
      aria-label={hidden ? 'Valor oculto' : undefined}
    >
      {formatCurrency(hidden ? PLACEHOLDER_VALUE : value, currency)}
    </span>
  )
}
