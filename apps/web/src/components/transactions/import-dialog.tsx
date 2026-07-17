import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { AlertTriangle, FileUp, Loader2 } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn, formatCurrency, formatLocalDate } from '@/lib/utils'
import type {
  ImportCommitResult,
  ImportPreviewResult,
  ImportPreviewTransaction,
  TransactionType,
} from '@/types/transaction'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const PREVIEW_TIMEOUT_MS = 120_000

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Despesa',
  income: 'Receita',
  investment: 'Investimento',
  transfer: 'Transferência',
}

const DOCUMENT_TYPE_LABELS = {
  extrato: 'Extrato bancário',
  fatura: 'Fatura de cartão',
} as const

interface EditableRow extends ImportPreviewTransaction {
  selected: boolean
}

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fallback para CSVs que a detecção automática não entendeu: abre o mapeamento manual de colunas. */
  onManualCsvFallback?: () => void
}

function amountClassName(type: TransactionType) {
  if (type === 'income') return 'text-income'
  if (type === 'expense') return 'text-expense'
  return 'text-foreground'
}

function amountPrefix(type: TransactionType) {
  if (type === 'income') return '+'
  if (type === 'expense') return '-'
  return ''
}

export function ImportDialog({ open, onOpenChange, onManualCsvFallback }: ImportDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isCsvFile, setIsCsvFile] = useState(false)

  function handleReset() {
    setPreview(null)
    setRows([])
    setPreviewError(null)
    setIsCsvFile(false)
  }

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<ImportPreviewResult>('/v1/transactions/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: PREVIEW_TIMEOUT_MS,
      })
      return data
    },
    onSuccess: (data) => {
      setPreviewError(null)
      setPreview(data)
      setRows(data.transactions.map((tx) => ({ ...tx, selected: true })))
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 422) {
        const detail = error.response.data?.detail
        setPreviewError(
          typeof detail === 'string' ? detail : 'Não foi possível ler o arquivo enviado.',
        )
        return
      }
      setPreviewError(
        'Não foi possível processar o arquivo. Verifique o formato (CSV, Excel ou PDF) e tente novamente.',
      )
    },
  })

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permite reescolher o mesmo arquivo depois de um erro.
    event.target.value = ''
    if (!file) return

    setIsCsvFile(file.name.toLowerCase().endsWith('.csv'))

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setPreviewError('O arquivo excede o limite de 10MB.')
      return
    }

    setPreviewError(null)
    previewMutation.mutate(file)
  }

  const selectedRows = rows.filter((row) => row.selected)

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('missing-preview')
      const { data } = await api.post<ImportCommitResult>('/v1/transactions/import/commit', {
        document_type: preview.document_type,
        transactions: selectedRows.map(({ selected: _selected, ...tx }) => tx),
      })
      return data
    },
    onSuccess: (result) => {
      toast({
        title: 'Importação concluída',
        description: `${result.created} lançamentos criados, ${result.reconciled} duplicados ignorados${
          result.skipped > 0 ? `, ${result.skipped} descartados` : ''
        }.`,
      })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      handleReset()
      onOpenChange(false)
    },
    onError: () =>
      toast({ variant: 'destructive', title: 'Não foi possível importar os lançamentos' }),
  })

  function toggleAll(checked: boolean) {
    setRows((current) => current.map((row) => ({ ...row, selected: checked })))
  }

  function toggleRow(index: number, checked: boolean) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, selected: checked } : row)))
  }

  function changeRowType(index: number, type: TransactionType) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, type } : row)))
  }

  const allSelected = rows.length > 0 && selectedRows.length === rows.length
  const isReviewing = preview !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleReset()
        onOpenChange(next)
      }}
    >
      <DialogContent className={cn(isReviewing ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>Importar lançamentos</DialogTitle>
          <DialogDescription>
            Envie extratos bancários ou faturas de cartão em CSV, Excel ou PDF. Detectamos e
            organizamos os lançamentos automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!isReviewing && (
          <div className="flex flex-col gap-4">
            <Input
              type="file"
              accept=".csv,.xls,.xlsx,.pdf"
              onChange={handleFileChange}
              disabled={previewMutation.isPending}
              aria-label="Arquivo de extrato ou fatura"
            />
            <p className="text-muted-foreground text-xs">
              Formatos aceitos: .csv, .xls, .xlsx e .pdf — máximo de 10MB.
            </p>

            {previewMutation.isPending && (
              <div className="text-muted-foreground flex items-center gap-2 rounded-md border p-3 text-sm">
                <Loader2 className="size-4 shrink-0 animate-spin" />
                Lendo o arquivo e identificando os lançamentos... Isso pode levar alguns segundos.
              </div>
            )}

            {previewError && !previewMutation.isPending && (
              <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <div className="text-expense flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{previewError}</span>
                </div>
                {isCsvFile && onManualCsvFallback && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      handleReset()
                      onManualCsvFallback()
                    }}
                  >
                    <FileUp className="size-4" />
                    Mapear colunas manualmente
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {isReviewing && (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  preview.document_type === 'extrato'
                    ? 'border-income/40 bg-income/10 text-income'
                    : 'border-warning/40 bg-warning/10 text-warning',
                )}
              >
                {DOCUMENT_TYPE_LABELS[preview.document_type]}
              </Badge>
              <span className="text-muted-foreground text-xs">
                confiança de {Math.round(preview.confidence * 100)}%
              </span>
            </div>

            {preview.warnings.length > 0 && (
              <div className="border-warning/40 bg-warning/10 text-warning flex flex-col gap-1 rounded-md border p-3 text-sm">
                {preview.warnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {rows.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Nenhum lançamento encontrado no arquivo.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                    Selecionar todos
                  </label>
                  <span className="text-muted-foreground tnum">
                    {selectedRows.length} de {rows.length} selecionados
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-md border">
                  {rows.map((row, index) => (
                    <div
                      key={`${row.date}-${row.description}-${index}`}
                      className={cn(
                        'flex items-center gap-3 border-b px-3 py-2 last:border-0',
                        !row.selected && 'opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary size-4 shrink-0"
                        checked={row.selected}
                        onChange={(e) => toggleRow(index, e.target.checked)}
                        aria-label={`Incluir "${row.description}"`}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{row.description}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatLocalDate(row.date)}
                        </span>
                      </div>
                      <Select
                        value={row.type}
                        onValueChange={(v) => changeRowType(index, v as TransactionType)}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-32 shrink-0 text-xs"
                          aria-label={`Tipo de "${row.description}"`}
                        >
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
                      <span
                        className={cn(
                          'tnum w-28 shrink-0 text-right text-sm font-medium whitespace-nowrap',
                          amountClassName(row.type),
                        )}
                      >
                        {amountPrefix(row.type)}
                        {formatCurrency(Math.abs(Number(row.amount)))}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={commitMutation.isPending}
                onClick={handleReset}
              >
                Escolher outro arquivo
              </Button>
              <Button
                type="button"
                disabled={selectedRows.length === 0 || commitMutation.isPending}
                onClick={() => commitMutation.mutate()}
              >
                {commitMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {commitMutation.isPending
                  ? 'Importando...'
                  : `Importar ${selectedRows.length} ${selectedRows.length === 1 ? 'lançamento' : 'lançamentos'}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
