import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useConfig } from '@/hooks/use-config'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { AiUnavailableError, ChatSessionExpiredError, streamChatMessage } from '@/lib/chat-stream'
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

/** Lista de conversas usada tanto no aside (desktop) quanto no Sheet (mobile). */
function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
}: {
  conversations: Conversation[] | undefined
  activeId: string | null
  onSelect: (id: string | null) => void
  onDelete: (conversation: Conversation) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Button onClick={() => onSelect(null)} variant="outline" className="justify-start gap-2">
        <Plus className="size-4" />
        Nova conversa
      </Button>
      <div className="flex flex-col gap-1 overflow-y-auto">
        {conversations?.map((conversation) => (
          <div
            key={conversation.id}
            role="button"
            tabIndex={0}
            className={cn(
              'group focus-visible:ring-ring/50 flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-[3px]',
              conversation.id === activeId ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
            )}
            onClick={() => onSelect(conversation.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(conversation.id)
              }
            }}
          >
            <span className="truncate">{conversation.title ?? 'Nova conversa'}</span>
            <button
              className="text-muted-foreground hover:text-destructive focus-visible:ring-ring/50 -my-2 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-md opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px]"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(conversation)
              }}
              aria-label={`Excluir conversa ${conversation.title ?? 'sem título'}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChatPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: config } = useConfig()
  const aiEnabled = config?.ai_enabled ?? false
  const [activeId, setActiveId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null)
  const [input, setInput] = useState('')
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Aborta o stream em andamento ao desmontar a página.
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

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

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      let accumulated = ''
      await streamChatMessage(
        conversationId,
        trimmed,
        (chunk) => {
          accumulated += chunk
          setStreamingText(accumulated)
        },
        controller.signal,
      )
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      if (!aborted) {
        if (error instanceof AiUnavailableError) {
          // Fallback: a flag pode ter mudado no servidor depois do /config ser cacheado.
          toast({
            variant: 'destructive',
            title: 'Assistente de IA não configurado',
            description: 'Configure um provedor de IA no servidor para usar o chat.',
          })
        } else {
          toast({
            variant: 'destructive',
            title:
              error instanceof ChatSessionExpiredError
                ? 'Sessão expirada — entre novamente'
                : 'Não foi possível enviar a mensagem',
          })
        }
      }
    } finally {
      setIsSending(false)
      setStreamingText(null)
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    }
  }

  const messages = messagesQuery.data ?? []

  const activeConversation = conversationsQuery.data?.find((c) => c.id === activeId)

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-4">
      <aside className="hidden w-64 shrink-0 md:flex">
        <ConversationList
          conversations={conversationsQuery.data}
          activeId={activeId}
          onSelect={setActiveId}
          onDelete={setConversationToDelete}
        />
      </aside>

      {/* No mobile o histórico abre num Sheet, já que o aside fica oculto. */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetTitle className="font-display text-lg font-medium tracking-tight">
            Conversas
          </SheetTitle>
          <ConversationList
            conversations={conversationsQuery.data}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id)
              setHistoryOpen(false)
            }}
            onDelete={setConversationToDelete}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col rounded-md border">
        <div className="flex items-center gap-2 border-b p-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Histórico de conversas"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-4" />
          </Button>
          <span className="truncate text-sm font-medium">
            {activeConversation?.title ?? 'Nova conversa'}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !streamingText && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-muted-foreground text-sm">
                {aiEnabled
                  ? 'Pergunte algo sobre suas finanças'
                  : 'O histórico de conversas continua disponível aqui.'}
              </p>
              {aiEnabled && (
                <div className="flex flex-col gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <Button key={question} variant="outline" size="sm" onClick={() => handleSend(question)}>
                      {question}
                    </Button>
                  ))}
                </div>
              )}
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

        {aiEnabled ? (
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
            <Button type="submit" aria-label="Enviar mensagem" disabled={isSending || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-3 border-t p-4">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
              <Sparkles className="text-muted-foreground size-5" aria-hidden />
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium">O assistente de IA ainda não está configurado</p>
              <p className="text-muted-foreground text-sm">
                Configure um provedor de IA para conversar sobre suas finanças.
              </p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={conversationToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConversationToDelete(null)
        }}
        title={
          conversationToDelete?.title
            ? `Excluir a conversa "${conversationToDelete.title}"?`
            : 'Excluir esta conversa?'
        }
        description="Todo o histórico de mensagens desta conversa será removido. Esta ação não pode ser desfeita."
        confirmLabel="Excluir conversa"
        onConfirm={() => {
          if (conversationToDelete) deleteConversation.mutate(conversationToDelete.id)
          setConversationToDelete(null)
        }}
      />
    </div>
  )
}
