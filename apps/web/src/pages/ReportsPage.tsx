import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarSearch, Loader2, Printer, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { EmptyState } from '@/components/shared/empty-state'
import { PageError } from '@/components/shared/page-error'
import { ChartSkeleton, StatCardSkeleton } from '@/components/shared/page-skeleton'
import { PrivacyValue } from '@/components/shared/privacy-value'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { formatCurrency, formatCurrencyCompact, lastDayOfMonthISODate } from '@/lib/utils'
import type { AIAnalysisJob, AIAnalysisStatus, MonthlyReport, YearlyReport } from '@/types/report'

const CATEGORY_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

async function fetchMonthlyReport(year: number, month: number) {
  const { data } = await api.get<MonthlyReport>('/v1/reports/monthly', { params: { year, month } })
  return data
}

async function fetchYearlyReport(year: number) {
  const { data } = await api.get<YearlyReport>('/v1/reports/yearly', { params: { year } })
  return data
}

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 60

export function ReportsPage() {
  const today = new Date()
  const { toast } = useToast()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [jobId, setJobId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)

  const monthlyQuery = useQuery({
    queryKey: ['reports', 'monthly', year, month],
    queryFn: () => fetchMonthlyReport(year, month),
  })
  const yearlyQuery = useQuery({
    queryKey: ['reports', 'yearly', year],
    queryFn: () => fetchYearlyReport(year),
  })

  const requestAnalysis = useMutation({
    mutationFn: async () => {
      const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
      const periodEnd = lastDayOfMonthISODate(year, month)
      const { data } = await api.post<AIAnalysisJob>('/v1/reports/ai-analysis', {
        period_start: periodStart,
        period_end: periodEnd,
      })
      return data
    },
    onSuccess: (data) => {
      setJobId(data.job_id)
      setAnalysisResult(null)
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Não foi possível iniciar a análise' })
    },
  })

  useEffect(() => {
    if (!jobId) return

    let attempts = 0
    let cancelled = false

    const interval = setInterval(async () => {
      attempts += 1
      try {
        const { data } = await api.get<AIAnalysisStatus>(`/v1/reports/ai-analysis/${jobId}`)
        if (cancelled) return
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
          setAnalysisResult(data.result ?? 'Não foi possível gerar a análise.')
          setJobId(null)
        } else if (attempts >= MAX_POLL_ATTEMPTS) {
          setAnalysisResult('A análise demorou mais do que o esperado. Tente novamente.')
          setJobId(null)
        }
      } catch {
        if (cancelled) return
        setAnalysisResult('Não foi possível consultar o status da análise. Tente novamente.')
        setJobId(null)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId])

  async function handleExportCsv() {
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const periodEnd = lastDayOfMonthISODate(year, month)
    try {
      await downloadFile('/v1/transactions/export-csv', 'transacoes.csv', {
        date_from: periodStart,
        date_to: periodEnd,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível exportar o CSV' })
    }
  }

  const monthly = monthlyQuery.data
  const yearly = yearlyQuery.data
  const isLoading = monthlyQuery.isLoading || yearlyQuery.isLoading
  const isError = monthlyQuery.isError || yearlyQuery.isError
  const monthHasData =
    monthly !== undefined &&
    (Number(monthly.total_income) !== 0 ||
      Number(monthly.total_expenses) !== 0 ||
      monthly.expenses_by_category.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="font-display text-2xl font-medium tracking-tight">Relatórios</h1>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[today.getFullYear(), today.getFullYear() - 1, today.getFullYear() - 2].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCsv}>
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {isLoading && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      {isError && !isLoading && (
        <PageError
          onRetry={() => {
            monthlyQuery.refetch()
            yearlyQuery.refetch()
          }}
        />
      )}

      {!isLoading && !isError && !monthHasData && (
        <EmptyState
          icon={CalendarSearch}
          title="Sem dados neste período"
          description={`Nenhuma movimentação registrada em ${MONTH_NAMES[month - 1]} de ${year}. Selecione outro mês acima ou registre transações para gerar o relatório.`}
        />
      )}

      {!isLoading && !isError && monthHasData && (
        <>
      {monthly && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Receitas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              <PrivacyValue value={Number(monthly.total_income)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Despesas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              <PrivacyValue value={Number(monthly.total_expenses)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Saldo líquido</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              <PrivacyValue value={Number(monthly.net_balance)} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="relative h-72">
            {monthly && monthly.expenses_by_category.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={monthly.expenses_by_category.map((c) => ({ ...c, amount: Number(c.amount) }))}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={2}
                      stroke="var(--card)"
                    >
                      {monthly.expenses_by_category.map((entry, index) => (
                        <Cell key={entry.category_id ?? index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-muted-foreground text-xs">Total</span>
                  <PrivacyValue
                    value={Number(monthly.total_expenses)}
                    className="font-display text-xl font-medium"
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground text-sm">Sem despesas no período.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Comparativo mensal ({year})</CardTitle>
            <div className="flex items-center gap-4">
              <LegendDot color="var(--income)" label="Receitas" />
              <LegendDot color="var(--expense)" label="Despesas" />
            </div>
          </CardHeader>
          <CardContent className="h-72">
            {yearly && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={yearly.months.map((m) => ({
                    ...m,
                    income: Number(m.income),
                    expenses: Number(m.expenses),
                  }))}
                >
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m) => MONTH_NAMES[m - 1]}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                    width={56}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'color-mix(in srgb, var(--muted) 60%, transparent)' }}
                    content={<ChartTooltip labelFormatter={(m) => MONTH_NAMES[Number(m) - 1] ?? String(m)} />}
                  />
                  <Bar dataKey="income" name="Receitas" fill="var(--income)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Despesas" fill="var(--expense)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categorias — variação vs período anterior</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {monthly?.expenses_by_category.map((category) => (
            <div
              key={category.category_id ?? 'none'}
              className="flex items-center justify-between border-b py-2 text-sm last:border-0"
            >
              <span>{category.category}</span>
              <div className="flex items-center gap-3">
                <span>{formatCurrency(category.amount)}</span>
                {category.vs_previous !== null && (
                  <span className={category.vs_previous > 0 ? 'tnum text-expense' : 'tnum text-income'}>
                    {category.vs_previous > 0 ? '+' : ''}
                    {category.vs_previous.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Análise com IA</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            className="self-start"
            disabled={Boolean(jobId) || requestAnalysis.isPending}
            onClick={() => requestAnalysis.mutate()}
          >
            {jobId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {jobId ? 'Gerando análise...' : 'Gerar análise com IA'}
          </Button>

          {analysisResult && (
            <div className="chat-markdown rounded-md border p-4 text-sm">
              <Markdown>{analysisResult}</Markdown>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}
