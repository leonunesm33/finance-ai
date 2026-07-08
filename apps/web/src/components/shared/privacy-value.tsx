import { usePrivacyStore } from '@/stores/usePrivacyStore'

interface PrivacyValueProps {
  value: number
  currency?: string
  className?: string
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

export function PrivacyValue({ value, currency = 'BRL', className }: PrivacyValueProps) {
  const hidden = usePrivacyStore((state) => state.hidden)

  return (
    <span className={className} aria-label={hidden ? 'Valor oculto' : undefined}>
      {hidden ? '•••••' : formatCurrency(value, currency)}
    </span>
  )
}
