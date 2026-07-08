export type ConnectionStatus = 'UPDATING' | 'UPDATED' | 'LOGIN_ERROR' | 'OUTDATED'

export interface BankConnection {
  id: string
  pluggy_item_id: string
  institution_id: number
  institution_name: string
  institution_logo_url: string | null
  status: ConnectionStatus
  last_sync_at: string | null
  error_message: string | null
  created_at: string
}

export interface BankAccount {
  id: string
  connection_id: string
  name: string
  type: 'BANK' | 'CREDIT' | 'INVESTMENT'
  subtype: string | null
  number: string | null
  currency: string
  balance: number
  credit_limit: number | null
  available_credit: number | null
  due_date: string | null
  last_sync_at: string | null
}

export interface BankAccountsSummary {
  total_balance: number
  total_credit_limit: number
  total_credit_available: number
}
