export type InvestmentType = 'renda_fixa' | 'renda_variavel' | 'fundo' | 'cripto' | 'outro'

export interface Investment {
  id: string
  account_id: string | null
  name: string
  type: InvestmentType
  institution: string | null
  quantity: number
  unit_price: number | null
  current_value: number
  invested_amount: number
  income: number
  income_percentage: number | null
  last_updated: string | null
  created_at: string
}

export interface InvestmentsSummary {
  total_patrimony: number
  total_income: number
  income_percentage: number
  asset_count: number
  by_type: Record<string, number>
}
