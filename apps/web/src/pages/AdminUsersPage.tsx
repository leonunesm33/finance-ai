import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { Lock, MoreVertical, Plus, ShieldCheck, ShieldOff, Trash2, Unlock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PageError } from '@/components/shared/page-error'
import { ListSkeleton } from '@/components/shared/page-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
  type UpdateAdminUserPayload,
} from '@/hooks/use-admin-users'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import type { User, UserRole } from '@/types/user'

/** Extrai a mensagem de erro do backend (ex.: "último administrador", "própria conta"). */
function extractDetail(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ detail?: string }>(error) && error.response?.data?.detail) {
    return error.response.data.detail
  }
  return fallback
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Usuário',
}

const createUserSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  email: z.string().email('Informe um email válido'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
  role: z.enum(['user', 'admin']),
})

type CreateUserForm = z.infer<typeof createUserSchema>

function NewUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const createUser = useCreateAdminUser()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'user', name: '', email: '', password: '' },
  })

  function onSubmit(values: CreateUserForm) {
    createUser.mutate(values, {
      onSuccess: () => {
        toast({ title: 'Usuário criado com sucesso' })
        reset({ role: 'user', name: '', email: '', password: '' })
        onOpenChange(false)
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Não foi possível criar o usuário',
          description: extractDetail(error, 'Verifique os dados informados e tente novamente.'),
        })
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset({ role: 'user', name: '', email: '', password: '' })
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            A conta é criada com a senha informada abaixo; o próprio usuário pode trocá-la depois
            em Configurações.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-name">Nome</Label>
            <Input id="new-user-name" {...register('name')} />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input id="new-user-email" type="email" {...register('email')} />
            {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-password">Senha</Label>
            <Input id="new-user-password" type="password" {...register('password')} />
            {errors.password && (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Papel</Label>
            <Select
              value={watch('role')}
              onValueChange={(value) => setValue('role', value as UserRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? 'Criando...' : 'Criar usuário'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type PendingActionType = 'block' | 'unblock' | 'promote' | 'demote' | 'delete'

interface PendingAction {
  type: PendingActionType
  user: User
}

function confirmConfig(action: PendingAction) {
  switch (action.type) {
    case 'block':
      return {
        title: `Bloquear ${action.user.name}?`,
        description:
          'Um usuário bloqueado não consegue mais fazer login no FinanceAI até ser desbloqueado novamente. Os dados dele são preservados.',
        confirmLabel: 'Bloquear usuário',
      }
    case 'unblock':
      return {
        title: `Desbloquear ${action.user.name}?`,
        description: 'O usuário volta a conseguir fazer login normalmente.',
        confirmLabel: 'Desbloquear usuário',
      }
    case 'promote':
      return {
        title: `Promover ${action.user.name} a administrador?`,
        description:
          'Administradores podem gerenciar todos os usuários do sistema: bloquear, promover, rebaixar e excluir contas.',
        confirmLabel: 'Promover a administrador',
      }
    case 'demote':
      return {
        title: `Rebaixar ${action.user.name} a usuário comum?`,
        description: 'A conta perde acesso imediato à área de administração.',
        confirmLabel: 'Rebaixar a usuário',
      }
    case 'delete':
      return {
        title: `Excluir ${action.user.name}?`,
        description:
          'Esta ação é IRREVERSÍVEL e apaga TODOS os dados financeiros deste usuário: transações, recorrências, metas, investimentos, contas e conexões bancárias, categorias, perfil e histórico de conversas com o assistente.',
        confirmLabel: 'Excluir definitivamente',
      }
  }
}

export function AdminUsersPage() {
  const { toast } = useToast()
  const currentUser = useAuthStore((state) => state.user)
  const { data: users, isLoading, isError, refetch } = useAdminUsers()
  const updateUser = useUpdateAdminUser()
  const deleteUser = useDeleteAdminUser()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  useEffect(() => {
    document.title = 'Administração — FinanceAI'
  }, [])

  function handleConfirm() {
    if (!pendingAction) return
    const { type, user } = pendingAction

    if (type === 'delete') {
      deleteUser.mutate(user.id, {
        onSuccess: () => {
          toast({
            title: 'Usuário excluído',
            description: `${user.name} e todos os seus dados financeiros foram removidos.`,
          })
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Não foi possível excluir o usuário',
            description: extractDetail(error, 'Tente novamente mais tarde.'),
          })
        },
      })
    } else {
      const payload: UpdateAdminUserPayload =
        type === 'block'
          ? { is_active: false }
          : type === 'unblock'
            ? { is_active: true }
            : type === 'promote'
              ? { role: 'admin' }
              : { role: 'user' }

      updateUser.mutate(
        { id: user.id, payload },
        {
          onSuccess: () => toast({ title: 'Usuário atualizado com sucesso' }),
          onError: (error) => {
            toast({
              variant: 'destructive',
              title: 'Não foi possível atualizar o usuário',
              description: extractDetail(error, 'Tente novamente mais tarde.'),
            })
          },
        },
      )
    }

    setPendingAction(null)
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-medium tracking-tight">
          Administração de usuários
        </h1>
        <PageError
          message="Não foi possível carregar a lista de usuários."
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const config = pendingAction ? confirmConfig(pendingAction) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">
            Administração de usuários
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie contas, papéis de acesso e bloqueios de login.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Novo usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-4">
              <ListSkeleton rows={5} />
            </div>
          )}

          {!isLoading && users && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Papel</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Criado em</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUser?.id
                    return (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{user.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              user.is_active
                                ? 'border-success/30 bg-success/10 text-success'
                                : 'border-warning/30 bg-warning/10 text-warning'
                            }
                          >
                            {user.is_active ? 'Ativo' : 'Bloqueado'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isSelf ? (
                            <span className="text-muted-foreground text-xs">Sua conta</span>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Ações para ${user.name}`}
                                >
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setPendingAction({
                                      type: user.is_active ? 'block' : 'unblock',
                                      user,
                                    })
                                  }
                                >
                                  {user.is_active ? (
                                    <Lock className="size-4" />
                                  ) : (
                                    <Unlock className="size-4" />
                                  )}
                                  {user.is_active ? 'Bloquear usuário' : 'Desbloquear usuário'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setPendingAction({
                                      type: user.role === 'admin' ? 'demote' : 'promote',
                                      user,
                                    })
                                  }
                                >
                                  {user.role === 'admin' ? (
                                    <ShieldOff className="size-4" />
                                  ) : (
                                    <ShieldCheck className="size-4" />
                                  )}
                                  {user.role === 'admin'
                                    ? 'Rebaixar a usuário'
                                    : 'Promover a administrador'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setPendingAction({ type: 'delete', user })}
                                >
                                  <Trash2 className="size-4" />
                                  Excluir usuário
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <NewUserDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
        title={config?.title ?? ''}
        description={config?.description}
        confirmLabel={config?.confirmLabel}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
