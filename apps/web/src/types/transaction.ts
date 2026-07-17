export type TransactionType = 'expense' | 'income' | 'investment' | 'transfer'
export type TransactionOrigin = 'manual' | 'open_finance' | 'csv_import'

export interface Transaction {
  id: string
  account_id: string | null
  category_id: string | null
  description: string
  amount: number
  type: TransactionType
  date: string
  notes: string | null
  origin: TransactionOrigin
  is_reconciled: boolean
  is_recurring: boolean
  ai_suggested_category_id: string | null
  ai_confidence: number | null
  created_at: string
}

export interface TransactionListResponse {
  items: Transaction[]
  total: number
  page: number
  page_size: number
}

export interface TransactionParseResult {
  description: string
  amount: number
  type: TransactionType
  category_id: string | null
  category_name: string | null
  date: string
  confidence: number
  alternatives: { category_name: string; confidence: number }[]
}

export interface CsvImportResult {
  created: number
  reconciled: number
  skipped: number
}

export type ImportFileFormat = 'csv' | 'xls' | 'xlsx' | 'pdf'
export type ImportDocumentType = 'extrato' | 'fatura'

export interface ImportPreviewTransaction {
  date: string
  description: string
  /** Valor serializado como string decimal pela API (ex.: "123.45"). */
  amount: string
  type: TransactionType
  category_id: string | null
}

/** Resposta de POST /v1/transactions/import/preview. */
export interface ImportPreviewResult {
  file_format: ImportFileFormat
  document_type: ImportDocumentType
  confidence: number
  transactions: ImportPreviewTransaction[]
  warnings: string[]
}

/** Resposta de POST /v1/transactions/import/commit. */
export interface ImportCommitResult {
  created: number
  reconciled: number
  skipped: number
}
