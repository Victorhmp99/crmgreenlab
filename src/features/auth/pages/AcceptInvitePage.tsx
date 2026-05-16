import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, AlertTriangle, Eye, EyeOff, Mail } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { fetchInviteByToken, acceptInvite } from '@/services/users'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  admin:   'Administrador',
  manager: 'Gestor',
  seller:  'Vendedor',
}

const schema = z
  .object({
    fullName: z.string().min(2, 'Nome muito curto'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm:  z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path:    ['confirm'],
  })
type FormData = z.infer<typeof schema>

type PageState = 'loading' | 'form' | 'invalid' | 'success'

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()

  const [pageState, setPageState]   = useState<PageState>('loading')
  const [inviteData, setInviteData] = useState<{
    email: string; role: UserRole; tenantName: string
  } | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Faz logout de qualquer sessão atual e carrega dados do convite
  useEffect(() => {
    if (!token) {
      setPageState('invalid')
      return
    }

    ;(async () => {
      // Limpa sessão para não confundir o fluxo
      await supabase.auth.signOut().catch(() => {})

      const data = await fetchInviteByToken(token)
      if (!data) {
        setPageState('invalid')
        return
      }
      setInviteData(data)
      setPageState('form')
    })()
  }, [token])

  // Cria a conta + aceita o convite
  async function onSubmit(data: FormData) {
    if (!inviteData || !token) return
    setError(null)

    try {
      // 1. Cria usuário no Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email:    inviteData.email,
        password: data.password,
      })

      if (signUpError) {
        // Se já tem conta com esse email, tenta fazer login
        if (signUpError.message.toLowerCase().includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email:    inviteData.email,
            password: data.password,
          })
          if (signInError) {
            setError('Já existe uma conta com este e-mail. Senha incorreta — entre pelo login e tente o link novamente.')
            return
          }
        } else {
          throw signUpError
        }
      } else if (!authData.session) {
        setError('Verifique seu e-mail para confirmar a conta antes de aceitar o convite.')
        return
      }

      // 2. Aceita o convite (adiciona ao tenant)
      await acceptInvite(token)

      // 3. Redireciona para o dashboard com hard reload
      setPageState('success')
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '#/dashboard'
      }, 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aceitar convite.'
      setError(msg)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-4 py-8">
          <Spinner size="lg" />
          <p className="text-sm" style={{ color: '#666' }}>Verificando convite...</p>
        </div>
      </AuthLayout>
    )
  }

  // ── Convite inválido ──────────────────────────────────────────────────────
  if (pageState === 'invalid') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)' }}>
            <AlertTriangle size={22} style={{ color: '#ff4444' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#e8e8e8' }}>Convite inválido</h2>
            <p className="text-sm mt-1" style={{ color: '#666' }}>
              Este link expirou ou já foi utilizado.
            </p>
          </div>
          <Button variant="ghost" onClick={() => window.location.hash = '#/login'}>
            Ir para o login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  // ── Sucesso ───────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)' }}>
            <CheckCircle size={22} style={{ color: 'var(--tenant-primary)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#e8e8e8' }}>
              Bem-vindo ao Green Hub!
            </h2>
            <p className="text-sm mt-1" style={{ color: '#666' }}>
              Conta criada. Redirecionando para o dashboard...
            </p>
          </div>
          <Spinner size="sm" />
        </div>
      </AuthLayout>
    )
  }

  // ── Formulário de cadastro ────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>Você foi convidado! 🎉</h1>
        {inviteData && (
          <div className="mt-3 rounded-xl px-4 py-3"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <p className="text-sm" style={{ color: '#aaa' }}>
              Para entrar em <strong style={{ color: '#e8e8e8' }}>{inviteData.tenantName}</strong> como{' '}
              <strong style={{ color: 'var(--tenant-primary)' }}>{ROLE_LABELS[inviteData.role]}</strong>
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#666' }}>
              <Mail size={12} />
              <span>{inviteData.email}</span>
            </div>
          </div>
        )}
        <p className="text-sm mt-3" style={{ color: '#666' }}>
          Crie sua senha para finalizar o cadastro.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Seu nome *"
          placeholder="Como devemos te chamar?"
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        {/* Senha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Criar senha *
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className="h-10 w-full rounded-lg px-3 pr-10 text-sm focus:outline-none"
              style={{
                background: '#1a1a1a',
                border: `1px solid ${errors.password ? '#ff4444' : '#2a2a2a'}`,
                color: '#e8e8e8',
              }}
              onFocus={(e) => { if (!errors.password) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
              {...register('password')}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#555' }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs" style={{ color: '#ff4444' }}>{errors.password.message}</p>}
        </div>

        {/* Confirmar senha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Confirmar senha *
          </label>
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Repita a senha"
            autoComplete="new-password"
            className="h-10 w-full rounded-lg px-3 text-sm focus:outline-none"
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

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Criar conta e entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
