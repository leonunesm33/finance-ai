import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plug, RefreshCw, Trash2 } from 'lucide-react'

import { PrivacyValue } from '@/components/shared/privacy-value'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePluggyConnect } from '@/hooks/use-pluggy-connect'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import type { BankAccount, BankAccountsSummary, BankConnection, ConnectionStatus } from '@/types/open-finance'

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  UPDATING: 'Sincronizando',
  UPDATED: 'Atualizado',
  LOGIN_ERROR: 'Erro de login',
  OUTDATED: 'Desatualizado',
}

function statusVariant(status: ConnectionStatus): 'default' | 'destructive' | 'secondary' {
  if (status === 'UPDATED') return 'default'
  if (status === 'LOGIN_ERROR') return 'destructive'
  return 'secondary'
}

async function fetchConnections() {
  const { data } = await api.get<BankConnection[]>('/v1/open-finance/connections')
  return data
}

async function fetchAccounts() {
  const { data } = await api.get<BankAccount[]>('/v1/bank-accounts/')
  return data
}

async function fetchSummary() {
  const { data } = await api.get<BankAccountsSummary>('/v1/bank-accounts/summary')
  return data
}

export function AccountsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { open: openPluggyWidget, loading: widgetLoading } = usePluggyConnect()

  const connectionsQuery = useQuery({ queryKey: ['open-finance', 'connections'], queryFn: fetchConnections })
  const accountsQuery = useQuery({ queryKey: ['bank-accounts'], queryFn: fetchAccounts })
  const summaryQuery = useQuery({ queryKey: ['bank-accounts', 'summary'], queryFn: fetchSummary })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['open-finance'] })
    queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
  }

  const registerItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.post('/v1/open-finance/items', { item_id: itemId })
    },
    onSuccess: () => {
      toast({ title: 'Banco conectado! A sincronização inicial pode levar alguns instantes.' })
      invalidateAll()
    },
    onError: () => toast({ variant: 'destructive', title: 'Não foi possível registrar a conexão' }),
  })

  const sync = useMutation({
    mutationFn: async (connectionId: string) => {
      await api.post(`/v1/open-finance/connections/${connectionId}/sync`)
    },
    onSuccess: () => {
      toast({ title: 'Sincronização iniciada' })
      invalidateAll()
    },
  })

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      await api.delete(`/v1/open-finance/connections/${connectionId}`)
    },
    onSuccess: () => {
      toast({ title: 'Banco desconectado' })
      invalidateAll()
    },
  })

  async function handleConnectBank() {
    try {
      const { data } = await api.post<{ connect_token: string }>('/v1/open-finance/connect-token')
      await openPluggyWidget(data.connect_token, (itemId) => registerItem.mutate(itemId))
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível iniciar a conexão',
        description: 'Verifique se as credenciais do Pluggy estão configuradas no servidor.',
      })
    }
  }

  const summary = summaryQuery.data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contas</h1>
        <Button onClick={handleConnectBank} disabled={widgetLoading}>
          {widgetLoading ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
          Conectar banco
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Saldo total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <PrivacyValue value={summary?.total_balance ?? 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Limite de cartão</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <PrivacyValue value={summary?.total_credit_limit ?? 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Crédito disponível</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <PrivacyValue value={summary?.total_credit_available ?? 0} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conexões bancárias</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {connectionsQuery.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhum banco conectado ainda.</p>
          )}
          {connectionsQuery.data?.map((connection) => (
            <div key={connection.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                {connection.institution_logo_url && (
                  <img src={connection.institution_logo_url} alt="" className="size-8 rounded" />
                )}
                <div>
                  <p className="text-sm font-medium">{connection.institution_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {connection.last_sync_at
                      ? `Última sincronização: ${new Date(connection.last_sync_at).toLocaleString('pt-BR')}`
                      : 'Ainda não sincronizado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(connection.status)}>
                  {STATUS_LABEL[connection.status] ?? connection.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sincronizar agora"
                  onClick={() => sync.mutate(connection.id)}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Desconectar"
                  onClick={() => disconnect.mutate(connection.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {accountsQuery.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhuma conta sincronizada ainda.</p>
          )}
          {accountsQuery.data?.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{account.name}</p>
                <p className="text-muted-foreground text-xs">
                  {account.type}
                  {account.number ? ` •••• ${account.number}` : ''}
                </p>
              </div>
              <PrivacyValue value={account.balance} currency={account.currency} className="font-medium" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
