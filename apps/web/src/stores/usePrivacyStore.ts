import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PrivacyState {
  hidden: boolean
  setHidden: (hidden: boolean) => void
  toggle: () => void
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set, get) => ({
      hidden: false,
      setHidden: (hidden) => set({ hidden }),
      toggle: () => set({ hidden: !get().hidden }),
    }),
    { name: 'financeai-privacy' },
  ),
)
