import { useCallback, useState } from 'react'

const SCRIPT_SRC = 'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js'

interface PluggyConnectSuccessData {
  item: { id: string }
}

interface PluggyConnectOptions {
  connectToken: string
  includeSandbox?: boolean
  onSuccess: (data: PluggyConnectSuccessData) => void
  onError?: (error: unknown) => void
}

interface PluggyConnectInstance {
  init: () => void
}

declare global {
  interface Window {
    PluggyConnect?: new (options: PluggyConnectOptions) => PluggyConnectInstance
  }
}

function loadScript(): Promise<void> {
  if (window.PluggyConnect) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar o Pluggy Connect')))
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar o Pluggy Connect'))
    document.body.appendChild(script)
  })
}

export function usePluggyConnect() {
  const [loading, setLoading] = useState(false)

  const open = useCallback(async (connectToken: string, onSuccess: (itemId: string) => void) => {
    setLoading(true)
    try {
      await loadScript()
      if (!window.PluggyConnect) {
        throw new Error('Pluggy Connect não está disponível')
      }

      const widget = new window.PluggyConnect({
        connectToken,
        includeSandbox: true,
        onSuccess: (data) => onSuccess(data.item.id),
      })
      widget.init()
    } finally {
      setLoading(false)
    }
  }, [])

  return { open, loading }
}
