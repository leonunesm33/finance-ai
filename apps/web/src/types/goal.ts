export type GoalType = 'expense_limit' | 'income_target' | 'savings' | 'investment'
export type GoalPeriod = 'monthly' | 'yearly' | 'one_time'

export interface Goal {
  id: string
  name: string
  type: GoalType
  category_id: string | null
  target_amount: number
  current_amount: number
  period: GoalPeriod
  deadline: string | null
  is_active: boolean
  created_at: string
}
