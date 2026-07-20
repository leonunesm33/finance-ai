import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { User, UserRole } from '@/types/user'

export const ADMIN_USERS_KEY = ['admin', 'users']

export interface CreateAdminUserPayload {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateAdminUserPayload {
  role?: UserRole
  is_active?: boolean
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ADMIN_USERS_KEY,
    queryFn: async () => {
      const { data } = await api.get<User[]>('/v1/admin/users/')
      return data
    },
  })
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAdminUserPayload) => {
      const { data } = await api.post<User>('/v1/admin/users/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY })
    },
  })
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateAdminUserPayload }) => {
      const { data } = await api.patch<User>(`/v1/admin/users/${id}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY })
    },
  })
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/admin/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY })
    },
  })
}
