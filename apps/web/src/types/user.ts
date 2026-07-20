export type AIPersonality = 'neutro' | 'direto' | 'motivador'
export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  privacy_mode: boolean
  ai_personality: AIPersonality
  currency: string
  timezone: string
  role: UserRole
  is_active: boolean
  created_at: string
}
