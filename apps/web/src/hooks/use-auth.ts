import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
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
  const syncFromServer = usePrivacyStore((state) => state.syncFromServer)

  const query = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: Boolean(accessToken),
  })

  const user = query.data
  useEffect(() => {
    if (!user) return
    setUser(user)
    // Sincroniza o privacy_mode apenas no primeiro load do usuário,
    // sem sobrescrever o toggle local a cada refetch.
    syncFromServer(user.privacy_mode)
  }, [user, setUser, syncFromServer])

  return query
}

function applyTokenResponse(data: TokenResponse) {
  const { setAccessToken, setUser } = useAuthStore.getState()
  setAccessToken(data.access_token)
  if (data.user) setUser(data.user)
}

export function useLogin() {
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<TokenResponse>('/v1/auth/login', payload)
      return data
    },
    onSuccess: applyTokenResponse,
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data } = await api.post<TokenResponse>('/v1/auth/register', payload)
      return data
    },
    onSuccess: applyTokenResponse,
  })
}

export function useLogout() {
  const clear = useAuthStore((state) => state.clear)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return async () => {
    clear()
    queryClient.clear()
    navigate('/login', { replace: true })

    try {
      // O backend limpa o cookie httpOnly do refresh token.
      await api.post('/v1/auth/logout')
    } catch {
      // best-effort: sessão local já foi encerrada
    }
  }
}
