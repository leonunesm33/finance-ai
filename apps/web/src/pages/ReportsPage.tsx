import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Printer, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import type { AIAnalysisJob, AIAnalysisStatus, MonthlyReport, YearlyReport } from '@/types/report'

const CATEGORY_COLORS = [
  '#2a78d6',
  '#1baf7a',
  '#eda100',
  '#008300',
  '#4a3aa7',
  '#e34948',
  '#e87ba4',
  '#eb6834',
]

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

async function fetchMonthlyReport(year: number, month: number) {
  const { data } = await api.get<MonthlyReport>('/v1/reports/monthly', { params: { year, month } })
  return data
}

async function fetchYearlyReport(year: number) {
  const { data } = await api.get<YearlyReport>('/v1/reports/yearly', { params: { year } })
  return data
}

export function ReportsPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [jobId, setJobId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10)
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
  })

  useEffect(() => {
    if (!jobId) return

    pollRef.current = setInterval(async () => {
      const { data } = await api.get<AIAnalysisStatus>(`/v1/reports/ai-analysis/${jobId}`)
      if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
        setAnalysisResult(data.result ?? 'Não foi possível gerar a análise.')
        setJobId(null)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobId])

  function handleExportCsv() {
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10)
    window.open(
      `/api/v1/transactions/export-csv?date_from=${periodStart}&date_to=${periodEnd}`,
      '_blank',
    )
  }

  const monthly = monthlyQuery.data
  const yearly = yearlyQuery.data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
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

      {monthly && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Receitas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(monthly.total_income)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Despesas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(monthly.total_expenses)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Saldo líquido</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(monthly.net_balance)}</CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="flex h-72 items-center justify-center">
            {monthly && monthly.expenses_by_category.length > 0 ? (
              <PieChart width={320} height={280}>
                <Pie
                  data={monthly.expenses_by_category.map((c) => ({ ...c, amount: Number(c.amount) }))}
                  dataKey="amount"
                  nameKey="category"
                  outerRadius={100}
                  label={(props: { name?: string }) => props.name ?? ''}
                >
                  {monthly.expenses_by_category.map((entry, index) => (
                    <Cell key={entry.category_id ?? index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            ) : (
              <p className="text-muted-foreground text-sm">Sem despesas no período.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparativo mensal ({year})</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {yearly && (
              <BarChart
                width={420}
                height={280}
                data={yearly.months.map((m) => ({
                  ...m,
                  income: Number(m.income),
                  expenses: Number(m.expenses),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m) => MONTH_NAMES[m - 1]} fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => formatCurrency(v)} width={70} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill="#16a34a" />
                <Bar dataKey="expenses" name="Despesas" fill="#dc2626" />
              </BarChart>
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
    </div>
  )
}
