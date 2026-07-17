import { formatCurrency } from '@/lib/utils'

interface ChartTooltipPayloadItem {
  name?: string | number
  value?: number | string
  color?: string
  payload?: { fill?: string }
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
  label?: string | number
  /** Formata o rótulo (ex.: data) exibido no topo do tooltip. */
  labelFormatter?: (label: string | number) => string
  /** Formata os valores; por padrão, moeda BRL por extenso. */
  valueFormatter?: (value: number) => string
}

/**
 * Tooltip custom do sistema de gráficos "Cofre Editorial".
 * Uso: <Tooltip content={<ChartTooltip />} />
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = formatCurrency,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="bg-popover text-popover-foreground border-border rounded-lg border px-3 py-2 text-xs shadow-lg shadow-black/20">
      {label !== undefined && label !== '' && (
        <p className="text-muted-foreground mb-1.5 font-medium">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color ?? item.payload?.fill ?? 'var(--muted-foreground)' }}
              />
              <span className="text-muted-foreground">{String(item.name ?? '')}</span>
            </span>
            <span className="tnum font-medium">{valueFormatter(Number(item.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
