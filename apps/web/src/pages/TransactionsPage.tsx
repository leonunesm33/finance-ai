import { useQuery } from '@tanstack/react-query'
import { Download, Plus, Upload } from 'lucide-react'
import { useState } from 'react'

import { ImportCsvDialog } from '@/components/transactions/import-csv-dialog'
import { NewTransactionDialog } from '@/components/transactions/new-transaction-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCategories } from '@/hooks/use-categories'
import { api } from '@/lib/api'
import type { TransactionListResponse, TransactionOrigin, TransactionType } from '@/types/transaction'

const PAGE_SIZE = 50

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Despesa',
  income: 'Receita',
  investment: 'Investimento',
  transfer: 'Transferência',
}

const ORIGIN_LABELS: Record<TransactionOrigin, string> = {
  manual: 'Manual',
  open_finance: 'Open Finance',
  csv_import: 'CSV',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string>()
  const [categoryId, setCategoryId] = useState<string>()
  const [origin, setOrigin] = useState<string>()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { data: categories } = useCategories()

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', { page, type, categoryId, origin, search }],
    queryFn: async () => {
      const { data } = await api.get<TransactionListResponse>('/v1/transactions/', {
        params: {
          page,
          page_size: PAGE_SIZE,
          type: type || undefined,
          category_id: categoryId || undefined,
          origin: origin || undefined,
          search: search || undefined,
        },
      })
      return data
    },
  })

  async function handleExport() {
    const response = await api.get('/v1/transactions/export-csv', {
      params: { type: type || undefined, category_id: categoryId || undefined, origin: origin || undefined },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'transacoes.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Transações</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importar CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4" />
            Exportar
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Nova transação
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="max-w-xs"
          />
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryId}
            onValueChange={(v) => {
              setCategoryId(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={origin}
            onValueChange={(v) => {
              setOrigin(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ORIGIN_LABELS) as TransactionOrigin[]).map((o) => (
                <SelectItem key={o} value={o}>
                  {ORIGIN_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-6">
          {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
          {data?.items.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhuma transação encontrada.</p>
          )}
          {data?.items.map((tx) => {
            const category = tx.category_id ? categoryById.get(tx.category_id) : undefined
            return (
              <div key={tx.id} className="flex items-center justify-between border-b py-3 last:border-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{tx.description}</span>
                    {tx.ai_suggested_category_id && (
                      <Badge variant="secondary">Categorizada por IA — confirmar?</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                    {category && <span>· {category.name}</span>}
                    <Badge variant="outline">{ORIGIN_LABELS[tx.origin]}</Badge>
                    {tx.is_reconciled && <Badge variant="secondary">Reconciliada</Badge>}
                  </div>
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
            )
          })}

          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-muted-foreground text-sm">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <NewTransactionDialog open={newOpen} onOpenChange={setNewOpen} />
      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
