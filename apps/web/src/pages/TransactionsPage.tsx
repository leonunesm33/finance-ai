import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, MoreHorizontal, Plus, ReceiptText, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'

import { EmptyState } from '@/components/shared/empty-state'
import { PageError } from '@/components/shared/page-error'
import { ListSkeleton } from '@/components/shared/page-skeleton'
import { ImportCsvDialog } from '@/components/transactions/import-csv-dialog'
import { ImportDialog } from '@/components/transactions/import-dialog'
import { NewTransactionDialog } from '@/components/transactions/new-transaction-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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
import { downloadFile } from '@/lib/download'
import { formatLocalDate } from '@/lib/utils'
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

const SEARCH_DEBOUNCE_MS = 300

export function TransactionsPage() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string>()
  const [categoryId, setCategoryId] = useState<string>()
  const [origin, setOrigin] = useState<string>()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  // Fallback de mapeamento manual de colunas para CSVs que a detecção automática não entendeu.
  const [csvFallbackOpen, setCsvFallbackOpen] = useState(false)

  const { data: categories } = useCategories()

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [search])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['transactions', { page, type, categoryId, origin, search: debouncedSearch }],
    queryFn: async () => {
      const { data } = await api.get<TransactionListResponse>('/v1/transactions/', {
        params: {
          page,
          page_size: PAGE_SIZE,
          type: type || undefined,
          category_id: categoryId || undefined,
          origin: origin || undefined,
          search: debouncedSearch || undefined,
        },
      })
      return data
    },
    placeholderData: keepPreviousData,
  })

  async function handleExport() {
    try {
      await downloadFile('/v1/transactions/export-csv', 'transacoes.csv', {
        type: type || undefined,
        category_id: categoryId || undefined,
        origin: origin || undefined,
        search: debouncedSearch || undefined,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível exportar o CSV' })
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))
  const hasActiveFilters = Boolean(type || categoryId || origin || debouncedSearch)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-medium tracking-tight">Transações</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importar
          </Button>
          <Button variant="outline" className="hidden sm:inline-flex" onClick={handleExport}>
            <Download className="size-4" />
            Exportar
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Nova transação
          </Button>
          {/* No mobile as ações secundárias ficam num menu para não estourar o header. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="sm:hidden" aria-label="Mais ações">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                <Upload className="size-4" />
                Importar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExport()}>
                <Download className="size-4" />
                Exportar CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs"
          />
          <Select
            value={type ?? 'all'}
            onValueChange={(v) => {
              setType(v === 'all' ? undefined : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryId ?? 'all'}
            onValueChange={(v) => {
              setCategoryId(v === 'all' ? undefined : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={origin ?? 'all'}
            onValueChange={(v) => {
              setOrigin(v === 'all' ? undefined : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
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
          {isLoading && <ListSkeleton rows={8} />}
          {isError && <PageError onRetry={() => refetch()} />}
          {!isLoading && !isError && data?.items.length === 0 && (
            hasActiveFilters ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nenhuma transação encontrada com os filtros atuais.
              </p>
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="Nenhuma transação ainda"
                description="Registre sua primeira transação manualmente ou importe um extrato ou fatura (CSV, Excel ou PDF) para começar."
                action={
                  <>
                    <Button onClick={() => setNewOpen(true)}>
                      <Plus className="size-4" />
                      Nova transação
                    </Button>
                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                      <Upload className="size-4" />
                      Importar
                    </Button>
                  </>
                }
              />
            )
          )}
          {data?.items.map((tx) => {
            const category = tx.category_id ? categoryById.get(tx.category_id) : undefined
            return (
              <div key={tx.id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{tx.description}</span>
                    {tx.ai_suggested_category_id && (
                      <Badge variant="secondary">Categorizada por IA — confirmar?</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{formatLocalDate(tx.date)}</span>
                    {category && <span>· {category.name}</span>}
                    <Badge variant="outline">{ORIGIN_LABELS[tx.origin]}</Badge>
                    {tx.is_reconciled && <Badge variant="secondary">Reconciliada</Badge>}
                  </div>
                </div>
                <span
                  className={
                    tx.type === 'income'
                      ? 'tnum text-income shrink-0 font-medium whitespace-nowrap'
                      : 'tnum text-expense shrink-0 font-medium whitespace-nowrap'
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
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onManualCsvFallback={() => {
          setImportOpen(false)
          setCsvFallbackOpen(true)
        }}
      />
      <ImportCsvDialog open={csvFallbackOpen} onOpenChange={setCsvFallbackOpen} />
    </div>
  )
}
