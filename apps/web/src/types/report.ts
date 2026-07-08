import type { ExpenseByCategory } from './dashboard'

export interface MonthlyReport {
  year: number
  month: number
  total_income: number
  total_expenses: number
  net_balance: number
  expenses_by_category: ExpenseByCategory[]
  daily_spending: { date: string; expenses: number; income: number }[]
}

export interface YearlyReportMonth {
  month: number
  income: number
  expenses: number
}

export interface YearlyReport {
  year: number
  total_income: number
  total_expenses: number
  months: YearlyReportMonth[]
  expenses_by_category: ExpenseByCategory[]
}

export interface AIAnalysisJob {
  job_id: string
}

export interface AIAnalysisStatus {
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE'
  result: string | null
}
