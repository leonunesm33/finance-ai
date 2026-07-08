import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { streamChatMessage } from '@/lib/chat-stream'
import { cn } from '@/lib/utils'
import type { ChatMessage, Conversation } from '@/types/chat'

const SUGGESTED_QUESTIONS = [
  'Quanto gastei em alimentação este mês?',
  'Quais são minhas maiores despesas recorrentes?',
  'Faça um resumo financeiro da minha semana',
]

async function fetchConversations() {
  const { data } = await api.get<Conversation[]>('/v1/chat/conversations')
  return data
}

async function fetchMessages(conversationId: string) {
  const { data } = await api.get<ChatMessage[]>(`/v1/chat/conversations/${conversationId}/messages`)
  return data
}

export function ChatPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const conversationsQuery = useQuery({ queryKey: ['chat', 'conversations'], queryFn: fetchConversations })
  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages', activeId],
    queryFn: () => fetchMessages(activeId as string),
    enabled: Boolean(activeId),
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messagesQuery.data, streamingText])

  const createConversation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Conversation>('/v1/chat/conversations')
      return data
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      setActiveId(conversation.id)
    },
  })

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/chat/conversations/${id}`)
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      if (activeId === id) setActiveId(null)
    },
  })

  async function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    let conversationId = activeId
    if (!conversationId) {
      const conversation = await createConversation.mutateAsync()
      conversationId = conversation.id
    }

    setInput('')
    setIsSending(true)
    setStreamingText('')

    try {
      let accumulated = ''
      await streamChatMessage(conversationId, trimmed, (chunk) => {
        accumulated += chunk
        setStreamingText(accumulated)
      })
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível enviar a mensagem' })
    } finally {
      setIsSending(false)
      setStreamingText(null)
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    }
  }

  const messages = messagesQuery.data ?? []

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-4">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 md:flex">
        <Button onClick={() => setActiveId(null)} variant="outline" className="justify-start gap-2">
          <Plus className="size-4" />
          Nova conversa
        </Button>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {conversationsQuery.data?.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                'group flex items-center justify-between rounded-md px-3 py-2 text-sm',
                conversation.id === activeId
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 cursor-pointer',
              )}
              onClick={() => setActiveId(conversation.id)}
            >
              <span className="truncate">{conversation.title ?? 'Nova conversa'}</span>
              <button
                className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteConversation.mutate(conversation.id)
                }}
                aria-label="Excluir conversa"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col rounded-md border">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !streamingText && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-muted-foreground text-sm">
                Pergunte algo sobre suas finanças
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <Button key={question} variant="outline" size="sm" onClick={() => handleSend(question)}>
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[85%] rounded-lg px-4 py-2 text-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted mr-auto',
                )}
              >
                <div className="chat-markdown">
                  <Markdown>{message.content}</Markdown>
                </div>
              </div>
            ))}

            {streamingText !== null && (
              <div className="bg-muted mr-auto max-w-[85%] rounded-lg px-4 py-2 text-sm">
                <div className="chat-markdown">
                  <Markdown>{streamingText || '...'}</Markdown>
                </div>
              </div>
            )}
          </div>
        </div>

        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
        >
          <Input
            placeholder="Pergunte sobre suas finanças..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
