import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AppConfig } from '@/types/config'

/**
 * Feature flags públicas do servidor (/v1/config, sem auth).
 * staleTime Infinity: as flags só mudam com redeploy — uma busca por sessão basta.
 */
export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const { data } = await api.get<AppConfig>('/v1/config')
      return data
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
