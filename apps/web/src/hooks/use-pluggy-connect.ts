import { useCallback, useState } from 'react'

const SCRIPT_SRC = 'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js'
const SCRIPT_LOAD_TIMEOUT_MS = 15_000

// Sandbox só quando habilitado explicitamente por env (default: false).
const INCLUDE_SANDBOX = import.meta.env.VITE_PLUGGY_SANDBOX === 'true'

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
    // Se já existe uma tag (de uma tentativa anterior que pode ter falhado),
    // remove e recarrega — os eventos load/error dela podem já ter disparado.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    existing?.remove()

    let settled = false

    const timeoutId = setTimeout(() => {
      finish(() => reject(new Error('Tempo esgotado ao carregar o Pluggy Connect')))
    }, SCRIPT_LOAD_TIMEOUT_MS)

    function finish(action: () => void) {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      action()
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => {
      finish(() => {
        if (window.PluggyConnect) resolve()
        else reject(new Error('Pluggy Connect não está disponível'))
      })
    }
    script.onerror = () => {
      script.remove()
      finish(() => reject(new Error('Falha ao carregar o Pluggy Connect')))
    }
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
        includeSandbox: INCLUDE_SANDBOX,
        onSuccess: (data) => onSuccess(data.item.id),
      })
      widget.init()
    } finally {
      setLoading(false)
    }
  }, [])

  return { open, loading }
}
