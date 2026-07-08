import type { Transaction } from './transaction'

export type DashboardPeriod = 'last_7_days' | 'current_month' | 'previous_month' | 'this_year' | 'custom'

export interface ExpenseByCategory {
  category_id: string | null
  category: string
  amount: number
  percentage: number
  vs_previous: number | null
}

export interface DailySpending {
  date: string
  expenses: number
  income: number
}

export interface OpenFinanceAccountSummary {
  connection_id: string
  institution_name: string
  institution_logo_url: string | null
  status: string
  last_sync_at: string | null
  balance: number
}

export interface DashboardAlert {
  type: 'budget_warning' | 'invoice_due' | 'negative_balance' | 'anomaly' | 'connection_error'
  message: string
}

export interface DashboardSummary {
  period: { start: string; end: string }
  total_income: number
  total_expenses: number
  savings_rate: number
  net_balance: number
  total_bank_balance: number
  total_credit_limit: number
  total_credit_available: number
  expenses_by_category: ExpenseByCategory[]
  daily_spending: DailySpending[]
  recent_transactions: Transaction[]
  open_finance_accounts: OpenFinanceAccountSummary[]
  alerts: DashboardAlert[]
}
