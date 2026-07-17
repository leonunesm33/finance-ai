import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { PageError } from '@/components/shared/page-error'
import { StatCardSkeleton } from '@/components/shared/page-skeleton'
import { PrivacyValue } from '@/components/shared/privacy-value'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { useCategories } from '@/hooks/use-categories'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import type { Goal, GoalPeriod, GoalType } from '@/types/goal'

const TYPE_LABELS: Record<GoalType, string> = {
  expense_limit: 'Limite de gasto',
  income_target: 'Meta de receita',
  savings: 'Poupança',
  investment: 'Investimento',
}

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  one_time: 'Único',
}

function progressColor(percentage: number) {
  if (percentage < 60) return 'bg-success'
  if (percentage <= 80) return 'bg-warning'
  return 'bg-destructive'
}

const formSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  type: z.enum(['expense_limit', 'income_target', 'savings', 'investment']),
  category_id: z.string().optional(),
  target_amount: z.coerce.number().positive('Informe um valor maior que zero'),
  period: z.enum(['monthly', 'yearly', 'one_time']),
})

type FormInput = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

function NewGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: categories } = useCategories()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: 'expense_limit', period: 'monthly' },
  })

  const createGoal = useMutation({
    mutationFn: async (values: FormOutput) => {
      await api.post('/v1/goals/', { ...values, category_id: values.category_id || null })
    },
    onSuccess: () => {
      toast({ title: 'Meta criada' })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      reset()
      onOpenChange(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Não foi possível criar a meta' }),
  })

  const type = watch('type')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => createGoal.mutate(values))}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-name">Nome</Label>
            <Input id="goal-name" {...register('name')} />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setValue('type', v as GoalType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as GoalType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'expense_limit' && (
            <div className="flex flex-col gap-2">
              <Label>Categoria</Label>
              <Select value={watch('category_id')} onValueChange={(v) => setValue('category_id', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-target">Valor alvo</Label>
              <Input id="goal-target" type="number" step="0.01" {...register('target_amount')} />
              {errors.target_amount && (
                <p className="text-destructive text-sm">{errors.target_amount.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Período</Label>
              <Select value={watch('period')} onValueChange={(v) => setValue('period', v as GoalPeriod)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIOD_LABELS) as GoalPeriod[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={createGoal.isPending}>
            {createGoal.isPending ? 'Salvando...' : 'Criar meta'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GoalsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null)

  const { data: goals, isLoading, isError, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data } = await api.get<Goal[]>('/v1/goals/')
      return data
    },
  })

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/goals/${id}`)
    },
    onSuccess: () => {
      toast({ title: 'Meta removida' })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  const totalTarget = goals?.reduce((sum, g) => sum + g.target_amount, 0) ?? 0
  const totalCurrent = goals?.reduce((sum, g) => sum + g.current_amount, 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight">Metas e Orçamentos</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nova meta
        </Button>
      </div>

      {isLoading && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardHeader className="space-y-0">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {isError && <PageError onRetry={() => refetch()} />}

      {goals && !isError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Metas ativas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{goals.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">Total orçado vs gasto</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              <PrivacyValue value={totalCurrent} /> <span className="text-muted-foreground text-base">/</span>{' '}
              <PrivacyValue value={totalTarget} />
            </CardContent>
          </Card>
        </div>
      )}

      {goals?.length === 0 && (
        <EmptyState
          icon={Target}
          title="Crie sua primeira meta"
          description="Defina limites de gasto ou objetivos de poupança e acompanhe o progresso mês a mês."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Nova meta
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals?.map((goal) => {
          const percentage = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
          return (
            <Card key={goal.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{goal.name}</CardTitle>
                  <p className="text-muted-foreground text-xs">{TYPE_LABELS[goal.type]}</p>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive focus-visible:ring-ring/50 -m-2.5 flex size-10 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-[3px]"
                  onClick={() => setGoalToDelete(goal)}
                  aria-label={`Excluir meta ${goal.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <PrivacyValue value={goal.current_amount} />
                  <PrivacyValue value={goal.target_amount} className="text-muted-foreground" />
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${progressColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">{Math.round(percentage)}% concluído</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <NewGoalDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDialog
        open={goalToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setGoalToDelete(null)
        }}
        title={goalToDelete ? `Excluir a meta "${goalToDelete.name}"?` : 'Excluir meta?'}
        description="A meta e o histórico de progresso serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir meta"
        onConfirm={() => {
          if (goalToDelete) deleteGoal.mutate(goalToDelete.id)
          setGoalToDelete(null)
        }}
      />
    </div>
  )
}
