import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { usePrivacyStore } from '@/stores/usePrivacyStore'
import type { LoginPayload, RegisterPayload, TokenResponse } from '@/types/auth'
import type { User } from '@/types/user'

async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/v1/users/me')
  return data
}

export function useCurrentUser() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const setUser = useAuthStore((state) => state.setUser)
  const setHidden = usePrivacyStore((state) => state.setHidden)

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await fetchMe()
      setUser(user)
      setHidden(user.privacy_mode)
      return user
    },
    enabled: Boolean(accessToken),
    retry: (failureCount, error) => {
      // 401 já passou pelo interceptor de refresh — tentar de novo não ajuda.
      if (axios.isAxiosError(error) && error.response?.status === 401) return false
      return failureCount < 2
    },
  })
}

export function useLogin() {
  const setTokens = useAuthStore((state) => state.setTokens)

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<TokenResponse>('/v1/auth/login', payload)
      return data
    },
    onSuccess: (data) => setTokens(data.access_token, data.refresh_token),
  })
}

export function useRegister() {
  const setTokens = useAuthStore((state) => state.setTokens)

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data } = await api.post<TokenResponse>('/v1/auth/register', payload)
      return data
    },
    onSuccess: (data) => setTokens(data.access_token, data.refresh_token),
  })
}

export function useLogout() {
  const clear = useAuthStore((state) => state.clear)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return async () => {
    const { refreshToken } = useAuthStore.getState()
    clear()
    queryClient.clear()
    navigate('/login', { replace: true })

    if (refreshToken) {
      try {
        await api.post('/v1/auth/logout', { refresh_token: refreshToken })
      } catch {
        // best-effort: sessão local já foi encerrada
      }
    }
  }
}
