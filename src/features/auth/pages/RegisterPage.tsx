import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckCircle, Building2, Clock, UserCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { registerTenant } from '@/services/register'
import { supabase } from '@/lib/supabase'

// Schema dinâmico: companyName só é obrigatório quando NÃO é "join existing tenant"
const baseSchema = z.object({
  companyName: z.string().optional(),
  email:       z.string().email('E-mail inválido'),
  password:    z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  confirm:     z.string(),
})
const schema = baseSchema.refine((d) => d.password === d.confirm, {
  message: 'As senhas não coincidem',
  path:    ['confirm'],
})

type RegisterForm = z.infer<typeof schema>

interface TokenInfo {
  valid:              boolean
  role?:              'admin' | 'manager' | 'seller'
  target_tenant_id?:  string | null
  target_tenant_name?: string | null
}

const ROLE_LABEL: Record<string, string> = {
  admin:   'Administrador',
  manager: 'Gestor',
  seller:  'Vendedor',
}

export function RegisterPage() {
  const [showPw, setShowPw]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [emailSent, setEmailSent]   = useState(false)
  const [isPending, setIsPending]   = useState(false)
  const [tokenInfo, setTokenInfo]   = useState<TokenInfo | null>(null)

  const hashParams  = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const signupToken = hashParams.get('ref') ?? undefined

  // Joining existing tenant = token traz um tenant específico
  const joiningExisting = tokenInfo?.valid && !!tokenInfo.target_tenant_id

  // Carrega info do token ao montar
  useEffect(() => {
    if (!signupToken) return
    Promise.resolve(supabase.rpc('get_signup_token_info', { p_token: signupToken }))
      .then(({ data }) => { if (data) setTokenInfo(data as TokenInfo) })
  }, [signupToken])

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) })

  async function onSubmit(data: RegisterForm) {
    try {
      setError(null)
      // Quando junta a tenant existente, o backend ignora o nome da empresa
      const companyName = joiningExisting ? 'placeholder' : (data.companyName ?? '')
      if (!joiningExisting && (!companyName || companyName.length < 2)) {
        setError('Informe o nome da empresa.')
        return
      }
      const result = await registerTenant(companyName, data.email, data.password, signupToken)

      if (result.needsEmailConfirmation) {
        setEmailSent(true)
      } else if (result.accountStatus === 'pending') {
        setIsPending(true)
      } else {
        // Master ou ativação imediata — hard reload para o AuthProvider reler a sessão
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

  // ── Conta criada — aguardando aprovação do admin ─────────────────────────
  if (isPending) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <div className="h-14 w-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <Clock size={28} style={{ color: '#fbbf24' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>Conta criada!</h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: '#888' }}>
              Sua conta está aguardando aprovação do administrador da plataforma.
              Você será notificado assim que o acesso for liberado.
            </p>
            <p className="text-xs mt-3" style={{ color: '#555' }}>{getValues('email')}</p>
          </div>
          <Link to="/login" className="text-sm transition-colors" style={{ color: '#555' }}>
            Voltar ao login
          </Link>
        </div>
      </AuthLayout>
    )
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
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>
          {joiningExisting ? 'Você foi convidado! 🎉' : 'Criar conta no Green Hub'}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>
          {joiningExisting
            ? 'Crie sua conta para entrar na empresa.'
            : 'Configure seu CRM em menos de 1 minuto.'}
        </p>
      </div>

      {joiningExisting && tokenInfo && (
        <div className="mb-4 rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <UserCheck size={18} style={{ color: 'var(--tenant-primary)' }} />
          <p className="text-sm" style={{ color: '#aaa' }}>
            Entrando em <strong style={{ color: '#e8e8e8' }}>{tokenInfo.target_tenant_name}</strong> como{' '}
            <strong style={{ color: 'var(--tenant-primary)' }}>
              {ROLE_LABEL[tokenInfo.role ?? 'seller']}
            </strong>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Nome da empresa — só aparece se NÃO está entrando em tenant existente */}
        {!joiningExisting && (
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
        )}

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
