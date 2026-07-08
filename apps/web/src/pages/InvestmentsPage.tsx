import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { z } from 'zod'

import { PrivacyValue } from '@/components/shared/privacy-value'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import type { BankAccount } from '@/types/open-finance'
import type { Investment, InvestmentsSummary, InvestmentType } from '@/types/investment'

const TYPE_LABELS: Record<InvestmentType, string> = {
  renda_fixa: 'Renda Fixa',
  renda_variavel: 'Renda Variável',
  fundo: 'Fundo',
  cripto: 'Cripto',
  outro: 'Outro',
}

const TYPE_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#e34948', '#4a3aa7', '#94a3b8']

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const formSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  type: z.enum(['renda_fixa', 'renda_variavel', 'fundo', 'cripto', 'outro']),
  institution: z.string().optional(),
  quantity: z.coerce.number().positive().default(1),
  current_value: z.coerce.number().min(0, 'Informe o valor atual'),
  invested_amount: z.coerce.number().min(0, 'Informe o valor investido'),
})

type FormInput = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

function NewInvestmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: 'renda_fixa', quantity: 1 },
  })

  const createInvestment = useMutation({
    mutationFn: async (values: FormOutput) => {
      await api.post('/v1/investments/', { ...values, institution: values.institution || null })
    },
    onSuccess: () => {
      toast({ title: 'Ativo cadastrado' })
      queryClient.invalidateQueries({ queryKey: ['investments'] })
      reset()
      onOpenChange(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Não foi possível cadastrar o ativo' }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo ativo</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => createInvestment.mutate(values))}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-name">Nome</Label>
            <Input id="inv-name" {...register('name')} />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as InvestmentType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as InvestmentType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-institution">Instituição</Label>
              <Input id="inv-institution" {...register('institution')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-invested">Valor investido</Label>
              <Input id="inv-invested" type="number" step="0.01" {...register('invested_amount')} />
              {errors.invested_amount && (
                <p className="text-destructive text-sm">{errors.invested_amount.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-current">Valor atual</Label>
              <Input id="inv-current" type="number" step="0.01" {...register('current_value')} />
              {errors.current_value && (
                <p className="text-destructive text-sm">{errors.current_value.message}</p>
              )}
            </div>
          </div>

          <Button type="submit" disabled={createInvestment.isPending}>
            {createInvestment.isPending ? 'Salvando...' : 'Cadastrar ativo'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function InvestmentsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: investments } = useQuery({
    queryKey: ['investments'],
    queryFn: async () => {
      const { data } = await api.get<Investment[]>('/v1/investments/')
      return data
    },
  })

  const { data: summary } = useQuery({
    queryKey: ['investments', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<InvestmentsSummary>('/v1/investments/summary')
      return data
    },
  })

  const { data: ofAccounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const { data } = await api.get<BankAccount[]>('/v1/bank-accounts/')
      return data
    },
  })

  const investmentAccounts = ofAccounts?.filter((a) => a.type === 'INVESTMENT') ?? []

  const deleteInvestment = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/investments/${id}`)
    },
    onSuccess: () => {
      toast({ title: 'Ativo removido' })
      queryClient.invalidateQueries({ queryKey: ['investments'] })
    },
  })

  const pieData = summary
    ? Object.entries(summary.by_type).map(([type, value]) => ({ type, value: Number(value) }))
    : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Investimentos</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Novo ativo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-normal">Patrimônio total</CardTitle>
            <Wallet className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <PrivacyValue value={summary?.total_patrimony ?? 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-normal">Rendimento total</CardTitle>
            {(summary?.total_income ?? 0) >= 0 ? (
              <TrendingUp className="size-4 text-green-600" />
            ) : (
              <TrendingDown className="size-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <PrivacyValue value={summary?.total_income ?? 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Rendimento %</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.income_percentage ?? 0}%</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Ativos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.asset_count ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por tipo</CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="type" outerRadius={90} label={(p: { name?: string }) => p.name ?? ''}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.type} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum ativo cadastrado ainda.</p>
          )}
        </CardContent>
      </Card>

      {investmentAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contas de investimento (Open Finance)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {investmentAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                <span>{account.name}</span>
                <PrivacyValue value={account.balance} currency={account.currency} className="font-medium" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ativos manuais</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {investments?.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhum ativo manual cadastrado.</p>
          )}
          {investments?.map((investment) => (
            <div key={investment.id} className="flex items-center justify-between border-b py-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{investment.name}</p>
                <p className="text-muted-foreground text-xs">
                  {TYPE_LABELS[investment.type]}
                  {investment.institution ? ` · ${investment.institution}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <PrivacyValue value={investment.current_value} className="block font-medium" />
                  <span
                    className={
                      investment.income >= 0
                        ? 'text-xs text-green-600 dark:text-green-400'
                        : 'text-xs text-red-600 dark:text-red-400'
                    }
                  >
                    {investment.income >= 0 ? '+' : ''}
                    {formatCurrency(investment.income)} ({Number(investment.income_percentage ?? 0).toFixed(1)}%)
                  </span>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteInvestment.mutate(investment.id)}
                  aria-label="Excluir ativo"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <NewInvestmentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
