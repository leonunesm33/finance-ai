import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { User } from '@/types/user'

interface AuthState {
  /** Access token vive apenas em memória — nunca é persistido. */
  accessToken: string | null
  user: User | null
  setAccessToken: (accessToken: string | null) => void
  setUser: (user: User | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'financeai-auth',
      version: 1,
      // Persiste apenas o usuário; tokens ficam fora do localStorage.
      partialize: (state) => ({ user: state.user }),
      // v0 persistia accessToken/refreshToken — descarta esses campos.
      migrate: (persisted) => ({ user: (persisted as { user?: User | null } | null)?.user ?? null }),
    },
  ),
)
