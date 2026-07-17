import { refreshSession } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

export class ChatSessionExpiredError extends Error {
  constructor() {
    super('Sessão expirada. Entre novamente.')
    this.name = 'ChatSessionExpiredError'
  }
}

/** O servidor respondeu 503: nenhum provedor de IA configurado (ai_enabled=false). */
export class AiUnavailableError extends Error {
  constructor() {
    super('Assistente de IA não configurado.')
    this.name = 'AiUnavailableError'
  }
}

async function ensureAccessToken(): Promise<string | null> {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) return accessToken
  return refreshSession()
}

function postMessage(
  conversationId: string,
  content: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`/api/v1/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
    signal,
  })
}

export async function streamChatMessage(
  conversationId: string,
  content: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let accessToken = await ensureAccessToken()
  if (!accessToken) throw new ChatSessionExpiredError()

  let response = await postMessage(conversationId, content, accessToken, signal)

  // Em 401, tenta um refresh e repete uma única vez.
  if (response.status === 401) {
    accessToken = await refreshSession()
    if (!accessToken) throw new ChatSessionExpiredError()
    response = await postMessage(conversationId, content, accessToken, signal)
  }

  if (!response.ok || !response.body) {
    if (response.status === 401) throw new ChatSessionExpiredError()
    if (response.status === 503) throw new AiUnavailableError()
    throw new Error('Falha ao enviar mensagem')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') return

      try {
        const { text } = JSON.parse(payload) as { text: string }
        onChunk(text)
      } catch {
        // ignora eventos malformados
      }
    }
  }
}
