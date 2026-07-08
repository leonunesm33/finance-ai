export type CategoryType = 'expense' | 'income' | 'both'

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string | null
  color: string | null
  type: CategoryType
  is_active: boolean
}
