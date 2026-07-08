import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'

import { api } from '@/lib/api'
import type { HealthStatus } from '@/types/health'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

async function fetchHealth(): Promise<HealthStatus> {
  const { data } = await api.get<HealthStatus>('/health')
  return data
}

function StatusRow({ label, status }: { label: string; status: 'ok' | 'error' }) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-b-0">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={status === 'ok' ? 'default' : 'destructive'} className="gap-1">
        {status === 'ok' ? <CheckCircle2 /> : <XCircle />}
        {status === 'ok' ? 'ok' : 'error'}
      </Badge>
    </div>
  )
}

export function HealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 15000,
  })

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>FinanceAI — Status da API</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          )}

          {isError && <StatusRow label="Conexão com a API" status="error" />}

          {data && (
            <div>
              <StatusRow label="API" status={data.status} />
              <StatusRow label="Banco de dados" status={data.db} />
              <StatusRow label="Redis" status={data.redis} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
