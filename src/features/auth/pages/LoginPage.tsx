import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError]       = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    try {
      setAuthError(null)
      await signIn(data.email, data.password)
      navigate('/dashboard')
    } catch {
      setAuthError('E-mail ou senha incorretos. Verifique suas credenciais.')
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>
          Entrar no Green Hub
        </h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>
          Gerencie seus leads e pipeline
        </p>
      </div>

      {authError && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Senha
            </label>
            <Link
              to="/forgot-password"
              className="text-xs transition-colors"
              style={{ color: 'var(--tenant-primary)' }}
            >
              Esqueceu a senha?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-10 w-full rounded-lg px-3 pr-10 text-sm transition-all duration-150 focus:outline-none"
              style={{
                background: '#1a1a1a',
                border: `1px solid ${errors.password ? '#ff4444' : '#2a2a2a'}`,
                color: '#e8e8e8',
              }}
              onFocus={(e) => {
                if (!errors.password) e.currentTarget.style.border = '1px solid var(--tenant-primary)'
              }}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs" style={{ color: '#ff4444' }}>{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
