import { useAuthStore } from '@/stores/authStore'

export async function streamChatMessage(
  conversationId: string,
  content: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const { accessToken } = useAuthStore.getState()

  const response = await fetch(`/api/v1/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ content }),
  })

  if (!response.ok || !response.body) {
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
