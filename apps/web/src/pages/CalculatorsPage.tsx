import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import {
  compoundInterest,
  emergencyFund,
  financialIndependence,
} from '@/lib/finance-calculators'
import { cn, formatCurrencyCompact } from '@/lib/utils'
import type { CalculatorPrefillData } from '@/types/calculator'

type Tab = 'compound' | 'emergency' | 'independence'

const TABS: { id: Tab; label: string }[] = [
  { id: 'compound', label: 'Juros Compostos' },
  { id: 'emergency', label: 'Fundo de Emergência' },
  { id: 'independence', label: 'Independência Financeira' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function usePrefillData() {
  return useQuery({
    queryKey: ['calculators', 'prefill'],
    queryFn: async () => {
      const { data } = await api.get<CalculatorPrefillData>('/v1/calculators/prefill')
      return data
    },
  })
}

function useSaveAsGoal() {
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (payload: { name: string; target_amount: number }) => {
      await api.post('/v1/goals/', {
        name: payload.name,
        type: 'savings',
        target_amount: payload.target_amount,
        period: 'one_time',
      })
    },
    onSuccess: () => toast({ title: 'Meta criada a partir do resultado' }),
    onError: () => toast({ variant: 'destructive', title: 'Não foi possível criar a meta' }),
  })
}

function CompoundInterestCalculator({ prefill }: { prefill?: CalculatorPrefillData }) {
  const [useRealData, setUseRealData] = useState(false)
  const [principal, setPrincipal] = useState('1000')
  const [monthlyContribution, setMonthlyContribution] = useState('200')
  const [annualRate, setAnnualRate] = useState('10')
  const [months, setMonths] = useState('60')
  const saveGoal = useSaveAsGoal()

  const contribution = useRealData && prefill ? prefill.avg_monthly_savings : Number(monthlyContribution)
  const result = useMemo(
    () => compoundInterest(Number(principal), contribution, Number(annualRate), Number(months)),
    [principal, contribution, annualRate, months],
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            variant={useRealData ? 'default' : 'outline'}
            size="sm"
            className="self-start"
            onClick={() => setUseRealData((v) => !v)}
          >
            Usar meus dados reais (aporte mensal)
          </Button>

          <div className="flex flex-col gap-2">
            <Label>Capital inicial</Label>
            <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Aporte mensal</Label>
            <Input
              type="number"
              value={useRealData ? contribution.toFixed(2) : monthlyContribution}
              disabled={useRealData}
              onChange={(e) => setMonthlyContribution(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Taxa de juros (% a.a.)</Label>
            <Input type="number" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Prazo (meses)</Label>
            <Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Valor final</p>
              <p className="text-xl font-semibold">{formatCurrency(result.finalValue)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Juros ganhos</p>
              <p className="text-xl font-semibold">{formatCurrency(result.interestEarned)}</p>
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={result.points}>
                <defs>
                  <linearGradient id="calcFillValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                  width={48}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--border)' }}
                  content={<ChartTooltip labelFormatter={(m) => `Mês ${m}`} />}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Valor acumulado"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  fill="url(#calcFillValue)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <Button
            variant="outline"
            className="self-start"
            onClick={() =>
              saveGoal.mutate({ name: 'Meta de juros compostos', target_amount: result.finalValue })
            }
          >
            Salvar resultado como meta
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function EmergencyFundCalculator({ prefill }: { prefill?: CalculatorPrefillData }) {
  const [useRealData, setUseRealData] = useState(false)
  const [monthlyExpenses, setMonthlyExpenses] = useState('2000')
  const [monthsCoverage, setMonthsCoverage] = useState('6')
  const [currentSaved, setCurrentSaved] = useState('0')
  const saveGoal = useSaveAsGoal()

  const expenses = useRealData && prefill ? prefill.avg_fixed_expenses_3m : Number(monthlyExpenses)
  const monthlySavings = prefill?.avg_monthly_savings ?? 0
  const result = emergencyFund(expenses, Number(monthsCoverage), Number(currentSaved), monthlySavings)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            variant={useRealData ? 'default' : 'outline'}
            size="sm"
            className="self-start"
            onClick={() => setUseRealData((v) => !v)}
          >
            Usar meus dados reais (despesas fixas)
          </Button>

          <div className="flex flex-col gap-2">
            <Label>Despesas mensais fixas</Label>
            <Input
              type="number"
              value={useRealData ? expenses.toFixed(2) : monthlyExpenses}
              disabled={useRealData}
              onChange={(e) => setMonthlyExpenses(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Meses de cobertura desejados</Label>
            <Input type="number" value={monthsCoverage} onChange={(e) => setMonthsCoverage(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Valor já guardado</Label>
            <Input type="number" value={currentSaved} onChange={(e) => setCurrentSaved(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground text-xs">Valor ideal do fundo</p>
            <p className="text-xl font-semibold">{formatCurrency(result.idealValue)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Quanto falta</p>
            <p className="text-xl font-semibold">{formatCurrency(result.missing)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Prazo sugerido</p>
            <p className="text-xl font-semibold">
              {result.monthsToReach !== null
                ? `${result.monthsToReach} meses`
                : 'Informe sua poupança mensal para estimar'}
            </p>
          </div>

          <Button
            variant="outline"
            className="self-start"
            onClick={() =>
              saveGoal.mutate({ name: 'Fundo de emergência', target_amount: result.idealValue })
            }
          >
            Salvar resultado como meta
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function FinancialIndependenceCalculator({ prefill }: { prefill?: CalculatorPrefillData }) {
  const [useRealData, setUseRealData] = useState(false)
  const [monthlyExpenses, setMonthlyExpenses] = useState('3000')
  const [annualReturn, setAnnualReturn] = useState('8')
  const saveGoal = useSaveAsGoal()

  const expenses = useRealData && prefill ? prefill.avg_monthly_expenses : Number(monthlyExpenses)
  const monthlySavings = prefill?.avg_monthly_savings ?? 0
  const result = financialIndependence(expenses, Number(annualReturn), monthlySavings)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            variant={useRealData ? 'default' : 'outline'}
            size="sm"
            className="self-start"
            onClick={() => setUseRealData((v) => !v)}
          >
            Usar meus dados reais (despesas médias)
          </Button>

          <div className="flex flex-col gap-2">
            <Label>Despesas mensais atuais</Label>
            <Input
              type="number"
              value={useRealData ? expenses.toFixed(2) : monthlyExpenses}
              disabled={useRealData}
              onChange={(e) => setMonthlyExpenses(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rendimento esperado da carteira (% a.a.)</Label>
            <Input type="number" value={annualReturn} onChange={(e) => setAnnualReturn(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground text-xs">Patrimônio necessário (regra dos 4%)</p>
            <p className="text-xl font-semibold">{formatCurrency(result.requiredNestEgg)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Prazo estimado (taxa de poupança atual)</p>
            <p className="text-xl font-semibold">
              {result.months !== null
                ? `${result.months} meses (${(result.months / 12).toFixed(1)} anos)`
                : 'Sem poupança mensal suficiente para estimar'}
            </p>
          </div>

          <Button
            variant="outline"
            className="self-start"
            onClick={() =>
              saveGoal.mutate({ name: 'Independência financeira', target_amount: result.requiredNestEgg })
            }
          >
            Salvar resultado como meta
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function CalculatorsPage() {
  const [tab, setTab] = useState<Tab>('compound')
  const { data: prefill } = usePrefillData()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium tracking-tight">Calculadoras</h1>

      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'text-muted-foreground border-transparent hover:text-foreground',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'compound' && <CompoundInterestCalculator prefill={prefill} />}
      {tab === 'emergency' && <EmergencyFundCalculator prefill={prefill} />}
      {tab === 'independence' && <FinancialIndependenceCalculator prefill={prefill} />}
    </div>
  )
}
