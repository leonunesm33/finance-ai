import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { AuthShell } from '@/components/shared/auth-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRegister } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'

const registerSchema = z.object({
  name: z.string().min(1, 'Informe seu nome'),
  email: z.string().email('Informe um email válido'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
})

type RegisterFormValues = z.infer<typeof registerSchema>

export function RegisterPage() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const navigate = useNavigate()
  const { toast } = useToast()
  const registerUser = useRegister()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: RegisterFormValues) {
    try {
      await registerUser.mutateAsync(values)
      navigate('/', { replace: true })
    } catch (error) {
      const message = axios.isAxiosError<{ detail?: string }>(error)
        ? error.response?.data?.detail
        : undefined

      toast({
        variant: 'destructive',
        title: 'Não foi possível criar a conta',
        description: message ?? 'Tente novamente em instantes.',
      })
    }
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-medium tracking-tight">
            Abra seu cofre
          </CardTitle>
          <CardDescription>Comece a organizar suas finanças</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={registerUser.isPending} className="mt-2">
              {registerUser.isPending ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
