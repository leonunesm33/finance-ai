import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formata um valor em BRL (ou outra moeda) por extenso: "R$ 1.234,56". */
export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

/**
 * Formatador compacto de moeda para eixos de gráficos: "R$ 1,2k", "R$ 3,4M".
 * Mantém os ticks curtos para caber em YAxis estreito.
 */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export function todayLocalISODate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Interpreta uma data "YYYY-MM-DD" (ou ISO com hora) no fuso local.
 * `new Date("YYYY-MM-DD")` parseia como UTC e, em UTC-3, exibe o dia anterior.
 */
export function parseLocalDate(iso: string): Date {
  const [datePart] = iso.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

/** Formata uma data "YYYY-MM-DD" em pt-BR respeitando o fuso local. */
export function formatLocalDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(iso).toLocaleDateString('pt-BR', options)
}

/** Último dia do mês como "YYYY-MM-DD", composto localmente (sem depender de fuso). */
export function lastDayOfMonthISODate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}
