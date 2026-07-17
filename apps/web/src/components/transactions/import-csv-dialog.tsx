import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'

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
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import type { CsvImportResult } from '@/types/transaction'

interface ImportCsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ParsedCsv {
  headers: string[]
  previewRows: string[][]
}

function parseCsvPreview(content: string): ParsedCsv {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const headers = (lines[0] ?? '').split(',').map((h) => h.trim())
  const previewRows = lines.slice(1, 6).map((line) => line.split(','))
  return { headers, previewRows }
}

export function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [dateColumn, setDateColumn] = useState<string>()
  const [descriptionColumn, setDescriptionColumn] = useState<string>()
  const [amountColumn, setAmountColumn] = useState<string>()
  const [typeColumn, setTypeColumn] = useState<string>()

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    if (!selected) {
      setParsed(null)
      return
    }
    const text = await selected.text()
    setParsed(parseCsvPreview(text))
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || !dateColumn || !descriptionColumn || !amountColumn) {
        throw new Error('missing-fields')
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('date_column', dateColumn)
      formData.append('description_column', descriptionColumn)
      formData.append('amount_column', amountColumn)
      if (typeColumn) formData.append('type_column', typeColumn)

      const { data } = await api.post<CsvImportResult>('/v1/transactions/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      })
      return data
    },
    onSuccess: (result) => {
      toast({
        title: 'Importação concluída',
        description: `${result.created} criadas, ${result.reconciled} reconciliadas, ${result.skipped} ignoradas.`,
      })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      handleReset()
      onOpenChange(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Não foi possível importar o CSV' }),
  })

  function handleReset() {
    setFile(null)
    setParsed(null)
    setDateColumn(undefined)
    setDescriptionColumn(undefined)
    setAmountColumn(undefined)
    setTypeColumn(undefined)
  }

  const canImport = Boolean(file && dateColumn && descriptionColumn && amountColumn)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleReset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar CSV</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input type="file" accept=".csv" onChange={handleFileChange} />

          {parsed && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ColumnSelect label="Data" value={dateColumn} onChange={setDateColumn} headers={parsed.headers} />
                <ColumnSelect
                  label="Descrição"
                  value={descriptionColumn}
                  onChange={setDescriptionColumn}
                  headers={parsed.headers}
                />
                <ColumnSelect
                  label="Valor"
                  value={amountColumn}
                  onChange={setAmountColumn}
                  headers={parsed.headers}
                />
                <ColumnSelect
                  label="Tipo (opcional)"
                  value={typeColumn}
                  onChange={setTypeColumn}
                  headers={parsed.headers}
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {parsed.headers.map((header) => (
                        <th key={header} className="p-2 text-left font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.previewRows.map((row, index) => (
                      <tr key={index} className="border-b last:border-0">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="p-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Button disabled={!canImport || importMutation.isPending} onClick={() => importMutation.mutate()}>
            {importMutation.isPending ? 'Importando...' : 'Confirmar importação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ColumnSelect({
  label,
  value,
  onChange,
  headers,
}: {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  headers: string[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione a coluna" />
        </SelectTrigger>
        <SelectContent>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
