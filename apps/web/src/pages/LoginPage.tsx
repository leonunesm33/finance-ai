import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { AuthShell } from '@/components/shared/auth-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useLogin } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/authStore'

const loginSchema = z.object({
  email: z.string().email('Informe um email válido'),
  password: z.string().min(1, 'Informe sua senha'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const navigate = useNavigate()
  const { toast } = useToast()
  const login = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: LoginFormValues) {
    try {
      await login.mutateAsync(values)
      navigate('/', { replace: true })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível entrar',
        description: 'Verifique seu email e senha e tente novamente.',
      })
    }
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-medium tracking-tight">
            Bem-vindo de volta
          </CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
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
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={login.isPending} className="mt-2">
              {login.isPending ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
