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
