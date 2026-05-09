import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckCircle, Building2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { registerTenant } from '@/services/register'

const schema = z
  .object({
    companyName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    email:       z.string().email('E-mail inválido'),
    password:    z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
    confirm:     z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path:    ['confirm'],
  })

type RegisterForm = z.infer<typeof schema>

export function RegisterPage() {
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) })

  async function onSubmit(data: RegisterForm) {
    try {
      setError(null)
      const result = await registerTenant(data.companyName, data.email, data.password)

      if (result.needsEmailConfirmation) {
        setEmailSent(true)
      } else {
        // Hard reload garante que o AuthProvider relê a sessão com a membership já criada
        window.location.href = window.location.origin + window.location.pathname + '#/dashboard'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta.'
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setError('Este e-mail já está cadastrado. Tente fazer login.')
      } else if (msg.includes('Password should be')) {
        setError('A senha deve ter ao menos 6 caracteres.')
      } else {
        setError(msg)
      }
    }
  }

  // ── Aguardando confirmação de e-mail ──────────────────────────────────────
  if (emailSent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <div className="h-14 w-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)' }}>
            <CheckCircle size={28} style={{ color: 'var(--tenant-primary)' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>Confirme seu e-mail</h2>
            <p className="text-sm mt-2" style={{ color: '#888' }}>Link enviado para</p>
            <p className="text-sm font-semibold mt-1" style={{ color: '#e8e8e8' }}>{getValues('email')}</p>
          </div>
          <Link to="/login" className="text-sm transition-colors" style={{ color: '#555' }}>
            Voltar ao login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>Criar conta no Green Hub</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Configure seu CRM em menos de 1 minuto</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Nome da empresa */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Nome da empresa *
          </label>
          <div className="relative">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: errors.companyName ? '#ff4444' : '#444' }} />
            <input
              type="text"
              placeholder="Ex: Agência Silva, Consultório Dr. João..."
              className="h-10 w-full rounded-lg pl-9 pr-3 text-sm transition-all focus:outline-none"
              style={{
                background: '#1a1a1a',
                border: `1px solid ${errors.companyName ? '#ff4444' : '#2a2a2a'}`,
                color: '#e8e8e8',
              }}
              onFocus={(e) => { if (!errors.companyName) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
              {...register('companyName')}
            />
          </div>
          {errors.companyName && <p className="text-xs" style={{ color: '#ff4444' }}>{errors.companyName.message}</p>}
        </div>

        <Input label="E-mail *" type="email" placeholder="admin@suaempresa.com"
          autoComplete="email" error={errors.email?.message} {...register('email')} />

        {/* Senha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Senha *</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className="h-10 w-full rounded-lg px-3 pr-10 text-sm transition-all focus:outline-none"
              style={{
                background: '#1a1a1a',
                border: `1px solid ${errors.password ? '#ff4444' : '#2a2a2a'}`,
                color: '#e8e8e8',
              }}
              onFocus={(e) => { if (!errors.password) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
              {...register('password')}
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#555' }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs" style={{ color: '#ff4444' }}>{errors.password.message}</p>}
        </div>

        {/* Confirmar senha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Confirmar senha *</label>
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Repita a senha"
            autoComplete="new-password"
            className="h-10 w-full rounded-lg px-3 text-sm transition-all focus:outline-none"
            style={{
              background: '#1a1a1a',
              border: `1px solid ${errors.confirm ? '#ff4444' : '#2a2a2a'}`,
              color: '#e8e8e8',
            }}
            onFocus={(e) => { if (!errors.confirm) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
            {...register('confirm')}
          />
          {errors.confirm && <p className="text-xs" style={{ color: '#ff4444' }}>{errors.confirm.message}</p>}
        </div>

        <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
          Criar conta e entrar
        </Button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: '#555' }}>
        Já tem conta?{' '}
        <Link to="/login" className="font-medium" style={{ color: 'var(--tenant-primary)' }}>
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
