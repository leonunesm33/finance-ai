import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CreditCard, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { PageError } from '@/components/shared/page-error'
import { ChartSkeleton, StatCardSkeleton } from '@/components/shared/page-skeleton'
import { PrivacyValue } from '@/components/shared/privacy-value'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { cn, formatCurrency, formatCurrencyCompact, formatLocalDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { usePrivacyStore } from '@/stores/usePrivacyStore'
import type { DashboardPeriod, DashboardSummary } from '@/types/dashboard'

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  last_7_days: 'Últimos 7 dias',
  current_month: 'Mês atual',
  previous_month: 'Mês anterior',
  this_year: 'Este ano',
  custom: 'Personalizado',
}

const ALERT_STYLES: Record<string, string> = {
  budget_warning: 'border-warning/40 bg-warning/10 text-warning',
  invoice_due: 'border-warning/40 bg-warning/10 text-warning',
  negative_balance: 'border-destructive/40 bg-destructive/10 text-expense',
  anomaly: 'border-destructive/40 bg-destructive/10 text-expense',
  connection_error: 'border-destructive/40 bg-destructive/10 text-expense',
}

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

/** Valor grande do herói: reais em Fraunces, centavos menores e esmaecidos. */
function HeroBalance({ value }: { value: number }) {
  const hidden = usePrivacyStore((state) => state.hidden)
  const formatted = formatCurrency(hidden ? 1234.56 : value)
  const separatorIndex = formatted.lastIndexOf(',')
  const integerPart = formatted.slice(0, separatorIndex)
  const cents = formatted.slice(separatorIndex)

  return (
    <span
      aria-label={hidden ? 'Valor oculto' : undefined}
      className={cn(
        'font-display tnum block leading-none font-medium tracking-tight transition-[filter] duration-300',
        hidden && 'blur-md select-none',
      )}
    >
      <span className="text-5xl">{integerPart}</span>
      <span className="text-muted-foreground text-3xl">{cents}</span>
    </span>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName,
}: {
  label: string
  value: number
  icon: typeof Wallet
  valueClassName?: string
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-normal">{label}</CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        <PrivacyValue value={value} className={valueClassName} />
      </CardContent>
    </Card>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [period, setPeriod] = useState<DashboardPeriod>('current_month')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>('/v1/dashboard/summary', { params: { period } })
      return data
    },
  })

  // A API serializa Decimal como string — recharts/aritmética exigem Number.
  const dailySpending = (data?.daily_spending ?? []).map((d) => ({
    ...d,
    expenses: Number(d.expenses),
    income: Number(d.income),
  }))
  const expensesByCategory = (data?.expenses_by_category ?? []).map((c) => ({
    ...c,
    amount: Number(c.amount),
  }))

  const maxCategoryAmount = Math.max(1, ...expensesByCategory.map((c) => c.amount))
  const monthlyLeftover = data ? Number(data.total_income) - Number(data.total_expenses) : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-medium tracking-tight">
          {user ? `Olá, ${user.name.split(' ')[0]}!` : 'Dashboard'}
        </h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as DashboardPeriod[])
              .filter((p) => p !== 'custom')
              .map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <>
          {/* Espelha o layout real (hero + 4 cards + 2 charts) para evitar layout shift. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="size-4 rounded-full" />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center gap-4">
                <Skeleton className="h-12 w-64 max-w-full" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </CardContent>
            </Card>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </>
      )}

      {isError && <PageError onRetry={() => refetch()} />}

      {data && (
        <>
          {data.alerts.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 rounded-md border p-3 text-sm ${ALERT_STYLES[alert.type] ?? ''}`}
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  {alert.message}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden sm:col-span-2 lg:col-span-2 lg:row-span-2">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-16 size-80 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 70%)',
                }}
              />
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  Saldo total em banco
                </CardTitle>
                <Wallet className="text-accent size-4" />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center gap-4">
                <HeroBalance value={data.total_bank_balance} />
                <p className="text-muted-foreground text-sm">
                  <span className={monthlyLeftover >= 0 ? 'text-income font-medium' : 'text-expense font-medium'}>
                    <PrivacyValue value={monthlyLeftover} />
                  </span>{' '}
                  {monthlyLeftover >= 0 ? 'sobraram no período' : 'de saldo negativo no período'}
                </p>
              </CardContent>
            </Card>

            <StatCard
              label="Receitas do período"
              value={data.total_income}
              icon={TrendingUp}
              valueClassName="text-income"
            />
            <StatCard
              label="Despesas do período"
              value={data.total_expenses}
              icon={TrendingDown}
              valueClassName="text-expense"
            />
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  Taxa de economia
                </CardTitle>
                <TrendingUp className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent className="tnum text-2xl font-semibold">
                {Math.round(data.savings_rate * 100)}%
              </CardContent>
            </Card>
            <StatCard
              label="Crédito disponível"
              value={data.total_credit_available}
              icon={CreditCard}
            />
          </div>

          {data.open_finance_accounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contas Open Finance</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data.open_finance_accounts.map((account) => {
                  const dotColor =
                    account.status === 'UPDATED'
                      ? 'bg-success'
                      : account.status === 'LOGIN_ERROR'
                        ? 'bg-destructive'
                        : 'bg-warning'
                  return (
                    <div
                      key={account.connection_id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {account.institution_logo_url && (
                          <img src={account.institution_logo_url} alt="" className="size-6 rounded" />
                        )}
                        <span className={`size-2 rounded-full ${dotColor}`} />
                        <span className="text-sm font-medium">{account.institution_name}</span>
                      </div>
                      <PrivacyValue value={account.balance} className="font-medium" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Evolução diária</CardTitle>
                <div className="flex items-center gap-4">
                  <LegendDot color="var(--income)" label="Receitas" />
                  <LegendDot color="var(--expense)" label="Despesas" />
                </div>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySpending}>
                    <defs>
                      <linearGradient id="dashFillIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--income)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--income)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dashFillExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--expense)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--expense)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => formatLocalDate(String(value), { day: '2-digit', month: '2-digit' })}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      width={56}
                      tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: 'var(--border)' }}
                      content={<ChartTooltip labelFormatter={(value) => formatLocalDate(String(value))} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Receitas"
                      stroke="var(--income)"
                      strokeWidth={2.5}
                      fill="url(#dashFillIncome)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      name="Despesas"
                      stroke="var(--expense)"
                      strokeWidth={2.5}
                      fill="url(#dashFillExpense)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top categorias de despesa</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {expensesByCategory.length === 0 && (
                  <p className="text-muted-foreground text-sm">Sem despesas no período.</p>
                )}
                {expensesByCategory.slice(0, 8).map((category, index) => (
                  <div key={category.category_id ?? 'none'} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{category.category}</span>
                      <div className="flex items-center gap-2">
                        <PrivacyValue value={category.amount} />
                        {category.vs_previous !== null && (
                          <span className={cn('tnum', category.vs_previous > 0 ? 'text-expense' : 'text-income')}>
                            {category.vs_previous > 0 ? '+' : ''}
                            {category.vs_previous.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(category.amount / maxCategoryAmount) * 100}%`,
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Últimas transações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {data.recent_transactions.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma transação no período.</p>
              )}
              {data.recent_transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate">{tx.description}</span>
                    <Badge variant="outline">{formatLocalDate(tx.date)}</Badge>
                  </div>
                  <span
                    className={cn('tnum shrink-0 font-medium whitespace-nowrap', tx.type === 'income' ? 'text-income' : 'text-expense')}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
