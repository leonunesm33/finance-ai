import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { PageError } from '@/components/shared/page-error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { usePrivacyStore } from '@/stores/usePrivacyStore'
import type { AIPersonality, User } from '@/types/user'

const profileSchema = z.object({
  name: z.string().min(1, 'Informe seu nome'),
  ai_personality: z.enum(['neutro', 'direto', 'motivador']),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Informe sua senha atual'),
  new_password: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
})

type PasswordFormValues = z.infer<typeof passwordSchema>

const PERSONALITY_LABELS: Record<AIPersonality, string> = {
  neutro: 'Neutro — objetivo e direto',
  direto: 'Direto — curto, foca em números',
  motivador: 'Motivador — tom positivo e encorajador',
}

function ProfileForm({ user }: { user: User }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)
  const setHidden = usePrivacyStore((state) => state.setHidden)
  const hidden = usePrivacyStore((state) => state.hidden)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, ai_personality: user.ai_personality },
  })

  const updateProfile = useMutation({
    mutationFn: async (payload: Partial<ProfileFormValues> & { privacy_mode?: boolean }) => {
      const { data } = await api.put<User>('/v1/users/me', payload)
      return data
    },
    onSuccess: (data) => {
      setUser(data)
      queryClient.setQueryData(['me'], data)
      toast({ title: 'Perfil atualizado com sucesso' })
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Não foi possível atualizar o perfil' })
    },
  })

  function onSubmit(values: ProfileFormValues) {
    updateProfile.mutate(values)
  }

  function togglePrivacy() {
    const previous = hidden
    const next = !hidden
    setHidden(next)
    updateProfile.mutate(
      { privacy_mode: next },
      { onError: () => setHidden(previous) },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Informações da sua conta e preferências da IA</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ai_personality">Personalidade da IA</Label>
            <Select
              value={watch('ai_personality')}
              onValueChange={(value) => setValue('ai_personality', value as AIPersonality)}
            >
              <SelectTrigger id="ai_personality" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERSONALITY_LABELS) as AIPersonality[]).map((personality) => (
                  <SelectItem key={personality} value={personality}>
                    {PERSONALITY_LABELS[personality]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={updateProfile.isPending} className="self-start">
            Salvar alterações
          </Button>
        </form>

        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Modo privacidade</p>
            <p className="text-muted-foreground text-sm">
              Oculta todos os valores monetários com {'•••••'}
            </p>
          </div>
          <Button variant="outline" onClick={togglePrivacy}>
            {hidden ? 'Ativado' : 'Desativado'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PasswordForm() {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) })

  const updatePassword = useMutation({
    mutationFn: async (payload: PasswordFormValues) => {
      await api.put('/v1/users/me/password', payload)
    },
    onSuccess: () => {
      toast({ title: 'Senha atualizada com sucesso' })
      reset()
    },
    onError: (error) => {
      const message = axios.isAxiosError<{ detail?: string }>(error)
        ? error.response?.data?.detail
        : undefined
      toast({
        variant: 'destructive',
        title: 'Não foi possível trocar a senha',
        description: message,
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Segurança</CardTitle>
        <CardDescription>Altere sua senha de acesso</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) => updatePassword.mutate(values))}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="current_password">Senha atual</Label>
            <Input id="current_password" type="password" {...register('current_password')} />
            {errors.current_password && (
              <p className="text-destructive text-sm">{errors.current_password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new_password">Nova senha</Label>
            <Input id="new_password" type="password" {...register('new_password')} />
            {errors.new_password && (
              <p className="text-destructive text-sm">{errors.new_password.message}</p>
            )}
          </div>

          <Button type="submit" disabled={updatePassword.isPending} className="self-start">
            Trocar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const { data: user, isLoading, isError, refetch } = useCurrentUser()

  useEffect(() => {
    document.title = 'Configurações — FinanceAI'
  }, [])

  if (isError) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="font-display text-2xl font-medium tracking-tight">Configurações</h1>
        <PageError message="Não foi possível carregar seu perfil." onRetry={() => refetch()} />
      </div>
    )
  }

  if (isLoading || !user) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="font-display text-2xl font-medium tracking-tight">Configurações</h1>
        {/* Espelha os dois cards de formulário (perfil e senha). */}
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="h-9 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-2xl font-medium tracking-tight">Configurações</h1>
      <ProfileForm user={user} />
      <PasswordForm />
    </div>
  )
}
