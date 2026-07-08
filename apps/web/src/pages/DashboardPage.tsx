import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CreditCard, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PrivacyValue } from '@/components/shared/privacy-value'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { DashboardPeriod, DashboardSummary } from '@/types/dashboard'

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  last_7_days: 'Últimos 7 dias',
  current_month: 'Mês atual',
  previous_month: 'Mês anterior',
  this_year: 'Este ano',
  custom: 'Personalizado',
}

const ALERT_STYLES: Record<string, string> = {
  budget_warning: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  invoice_due: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  negative_balance: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
  anomaly: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
  connection_error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Wallet
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-normal">{label}</CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        <PrivacyValue value={value} />
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [period, setPeriod] = useState<DashboardPeriod>('current_month')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>('/v1/dashboard/summary', { params: { period } })
      return data
    },
  })

  const maxCategoryAmount = Math.max(1, ...(data?.expenses_by_category.map((c) => c.amount) ?? [1]))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
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

      {isLoading && <p className="text-muted-foreground text-sm">Carregando dashboard...</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saldo total em banco" value={data.total_bank_balance} icon={Wallet} />
            <StatCard label="Receitas do período" value={data.total_income} icon={TrendingUp} />
            <StatCard label="Despesas do período" value={data.total_expenses} icon={TrendingDown} />
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  Taxa de economia
                </CardTitle>
                <CreditCard className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {Math.round(data.savings_rate * 100)}%
              </CardContent>
            </Card>
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
                      ? 'bg-green-500'
                      : account.status === 'LOGIN_ERROR'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
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
              <CardHeader>
                <CardTitle>Evolução diária</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.daily_spending}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                    />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} width={70} tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        borderColor: 'var(--border)',
                        color: 'var(--popover-foreground)',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="income"
                      name="Receitas"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Despesas"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top categorias de despesa</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data.expenses_by_category.length === 0 && (
                  <p className="text-muted-foreground text-sm">Sem despesas no período.</p>
                )}
                {data.expenses_by_category.slice(0, 8).map((category) => (
                  <div key={category.category_id ?? 'none'} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{category.category}</span>
                      <div className="flex items-center gap-2">
                        <PrivacyValue value={category.amount} />
                        {category.vs_previous !== null && (
                          <span
                            className={
                              category.vs_previous > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-green-600 dark:text-green-400'
                            }
                          >
                            {category.vs_previous > 0 ? '+' : ''}
                            {category.vs_previous.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(category.amount / maxCategoryAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

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

          <Card>
            <CardHeader>
              <CardTitle>Últimas transações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {data.recent_transactions.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma transação no período.</p>
              )}
              {data.recent_transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                  <div className="flex items-center gap-2">
                    <span>{tx.description}</span>
                    <Badge variant="outline">{new Date(tx.date).toLocaleDateString('pt-BR')}</Badge>
                  </div>
                  <span
                    className={
                      tx.type === 'income'
                        ? 'font-medium text-green-600 dark:text-green-400'
                        : 'font-medium text-red-600 dark:text-red-400'
                    }
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
