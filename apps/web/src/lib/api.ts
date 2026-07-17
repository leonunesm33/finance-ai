import axios from 'axios'

import { useAuthStore } from '@/stores/authStore'

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

/** Timeout maior para operações lentas (import CSV, parse com IA). */
export const LONG_REQUEST_TIMEOUT = 60_000

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  try {
    // O refresh token vive em cookie httpOnly (path=/api/v1/auth) — o browser
    // envia automaticamente na requisição same-origin; não há body.
    const { data } = await axios.post<{ access_token: string }>('/api/v1/auth/refresh')
    useAuthStore.getState().setAccessToken(data.access_token)
    return data.access_token
  } catch {
    useAuthStore.getState().clear()
    return null
  }
}

/**
 * Tenta renovar o access token via cookie httpOnly, deduplicando chamadas
 * concorrentes (fila anti-corrida). Retorna o novo token ou null (sessão
 * encerrada — o store é limpo).
 */
export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isAuthEndpoint = originalRequest?.url?.startsWith('/v1/auth/')

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      const newAccessToken = await refreshSession()
      if (newAccessToken) {
        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`)
        return api(originalRequest)
      }
      // refresh falhou: o store foi limpo e o ProtectedRoute redireciona para /login.
    }

    return Promise.reject(error)
  },
)
