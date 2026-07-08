import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
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
import { todayLocalISODate } from '@/lib/utils'
import type { TransactionParseResult, TransactionType } from '@/types/transaction'

const formSchema = z.object({
  description: z.string().min(1, 'Informe a descrição'),
  amount: z.coerce.number().positive('Informe um valor maior que zero'),
  type: z.enum(['expense', 'income', 'investment', 'transfer']),
  date: z.string().min(1, 'Informe a data'),
  category_id: z.string().optional(),
  notes: z.string().optional(),
})

type FormInput = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Despesa',
  income: 'Receita',
  investment: 'Investimento',
  transfer: 'Transferência',
}

interface NewTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewTransactionDialog({ open, onOpenChange }: NewTransactionDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: categories } = useCategories()
  const [freeText, setFreeText] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: 'expense', date: todayLocalISODate() },
  })

  const parse = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post<TransactionParseResult>('/v1/transactions/parse', { text })
      return data
    },
    onSuccess: (data) => {
      setValue('description', data.description)
      setValue('amount', data.amount)
      setValue('type', data.type)
      setValue('date', data.date)
      if (data.category_id) setValue('category_id', data.category_id)
      toast({ title: `Interpretado com ${Math.round(data.confidence * 100)}% de confiança` })
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível interpretar o texto',
        description: 'Preencha o formulário manualmente.',
      })
    },
  })

  const createTransaction = useMutation({
    mutationFn: async (values: FormOutput) => {
      await api.post('/v1/transactions/', {
        ...values,
        category_id: values.category_id || null,
      })
    },
    onSuccess: () => {
      toast({ title: 'Transação criada' })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      reset()
      setFreeText('')
      onOpenChange(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Não foi possível criar a transação' }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova transação</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="Descreva o gasto... (ex: gastei 45 no almoço)"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!freeText || parse.isPending}
              onClick={() => parse.mutate(freeText)}
            >
              <Sparkles className="size-4" />
              {parse.isPending ? '...' : 'IA'}
            </Button>
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => createTransaction.mutate(values))}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="tx-description">Descrição</Label>
              <Input id="tx-description" {...register('description')} />
              {errors.description && (
                <p className="text-destructive text-sm">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tx-amount">Valor</Label>
                <Input id="tx-amount" type="number" step="0.01" {...register('amount')} />
                {errors.amount && <p className="text-destructive text-sm">{errors.amount.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tx-date">Data</Label>
                <Input id="tx-date" type="date" {...register('date')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Tipo</Label>
                <Select value={watch('type')} onValueChange={(v) => setValue('type', v as TransactionType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as TransactionType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Categoria</Label>
                <Select value={watch('category_id')} onValueChange={(v) => setValue('category_id', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
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
            </div>

            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? 'Salvando...' : 'Salvar transação'}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
