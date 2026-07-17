import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PrivacyState {
  hidden: boolean
  /** true depois que o privacy_mode do servidor foi aplicado nesta sessão. */
  synced: boolean
  setHidden: (hidden: boolean) => void
  toggle: () => void
  /** Aplica o privacy_mode vindo do servidor apenas uma vez por load da app. */
  syncFromServer: (hidden: boolean) => void
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set, get) => ({
      hidden: false,
      synced: false,
      setHidden: (hidden) => set({ hidden }),
      toggle: () => set({ hidden: !get().hidden }),
      syncFromServer: (hidden) => {
        if (!get().synced) set({ hidden, synced: true })
      },
    }),
    {
      name: 'financeai-privacy',
      // `synced` é estado de sessão — não persiste.
      partialize: (state) => ({ hidden: state.hidden }),
    },
  ),
)
