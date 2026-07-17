import type { User } from './user'

export interface TokenResponse {
  access_token: string
  token_type: string
  // O refresh token não trafega mais no body — vem em cookie httpOnly.
  user?: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  name: string
}
