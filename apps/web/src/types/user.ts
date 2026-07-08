export type AIPersonality = 'neutro' | 'direto' | 'motivador'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  privacy_mode: boolean
  ai_personality: AIPersonality
  currency: string
  timezone: string
  created_at: string
}
