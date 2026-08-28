import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, AlertTriangle, Eye, EyeOff, Mail, UserCheck } from 'lucide-react'
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

// Esquema para novo usuário (precisa de nome + criar senha)
const newUserSchema = z
  .object({
    fullName: z.string().min(2, 'Nome muito curto'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm:  z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path:    ['confirm'],
  })

// Esquema para usuário existente (só precisa da senha atual)
const existingUserSchema = z.object({
  password: z.string().min(1, 'Informe sua senha'),
})

type NewUserForm      = z.infer<typeof newUserSchema>
type ExistingUserForm = z.infer<typeof existingUserSchema>

type PageState = 'loading' | 'form-new' | 'form-existing' | 'invalid' | 'success'

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()

  const [pageState, setPageState]   = useState<PageState>('loading')
  const [inviteData, setInviteData] = useState<{
    email: string; role: UserRole; tenantName: string
  } | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Carrega dados do convite e detecta se o e-mail já tem conta
  useEffect(() => {
    if (!token) { setPageState('invalid'); return }

    ;(async () => {
      // Limpa sessão para não confundir o fluxo
      await supabase.auth.signOut().catch(() => {})

      const data = await fetchInviteByToken(token)
      if (!data) { setPageState('invalid'); return }

      setInviteData(data)

      // Pergunta amarrada ao TOKEN, não ao e-mail: a versão anterior
      // respondia sobre qualquer endereço sem login, o que permitia varrer
      // uma lista e descobrir quem é cliente da plataforma.
      const { data: exists } = await supabase.rpc('invite_email_has_account', { p_token: token })

      setPageState(exists ? 'form-existing' : 'form-new')
    })()
  }, [token])

  // ── Formulário para NOVO usuário ──────────────────────────────────────────
  const newUserForm = useForm<NewUserForm>({
    resolver: zodResolver(newUserSchema),
  })

  async function onSubmitNew(data: NewUserForm) {
    if (!inviteData || !token) return
    setError(null)

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email:    inviteData.email,
        password: data.password,
        options:  { data: { full_name: data.fullName } },
      })

      if (signUpError) {
        // Usuário criou conta antes de aceitar — muda para fluxo existente
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setPageState('form-existing')
          return
        }
        throw signUpError
      }

      if (!authData.session) {
        setError('Verifique seu e-mail para confirmar a conta antes de aceitar o convite. Não achou? Confira também a caixa de spam ou lixo eletrônico.')
        return
      }

      await acceptInvite(token)
      setPageState('success')
      setTimeout(() => { window.location.href = window.location.origin + window.location.pathname + '?t=' + Date.now() + '#/dashboard' }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aceitar convite.')
    }
  }

  // ── Formulário para usuário EXISTENTE ─────────────────────────────────────
  const existingUserForm = useForm<ExistingUserForm>({
    resolver: zodResolver(existingUserSchema),
  })

  async function onSubmitExisting(data: ExistingUserForm) {
    if (!inviteData || !token) return
    setError(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    inviteData.email,
        password: data.password,
      })

      if (signInError) {
        setError('Senha incorreta. Use a senha da sua conta existente.')
        return
      }

      await acceptInvite(token)
      setPageState('success')
      setTimeout(() => { window.location.href = window.location.origin + window.location.pathname + '?t=' + Date.now() + '#/dashboard' }, 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aceitar convite.'
      // Membro já existe neste tenant
      if (msg.includes('already a member') || msg.includes('já é membro')) {
        setPageState('success')
        setTimeout(() => { window.location.href = window.location.origin + window.location.pathname + '?t=' + Date.now() + '#/dashboard' }, 1500)
      } else {
        setError(msg)
      }
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
              Acesso garantido. Redirecionando para o dashboard...
            </p>
          </div>
          <Spinner size="sm" />
        </div>
      </AuthLayout>
    )
  }

  // ── Cabeçalho comum ao formulário ─────────────────────────────────────────
  const inviteHeader = inviteData && (
    <div className="rounded-xl px-4 py-3 mt-3"
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
  )

  const errorBlock = error && (
    <div className="mb-4 rounded-lg px-4 py-3 text-sm"
      style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
      {error}
    </div>
  )

  // ── Formulário usuário EXISTENTE ──────────────────────────────────────────
  if (pageState === 'form-existing') {
    return (
      <AuthLayout>
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <UserCheck size={20} style={{ color: 'var(--tenant-primary)' }} />
            <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>Você foi convidado! 🎉</h1>
          </div>
          {inviteHeader}
          <p className="text-sm mt-3" style={{ color: '#888' }}>
            Você já tem uma conta com este e-mail. Informe sua senha para confirmar o acesso.
          </p>
        </div>

        {errorBlock}

        <form onSubmit={existingUserForm.handleSubmit(onSubmitExisting)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Sua senha *
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Sua senha atual"
                autoComplete="current-password"
                className="h-10 w-full rounded-lg px-3 pr-10 text-sm focus:outline-none"
                style={{
                  background: '#1a1a1a',
                  border: `1px solid ${existingUserForm.formState.errors.password ? '#ff4444' : '#2a2a2a'}`,
                  color: '#e8e8e8',
                }}
                {...existingUserForm.register('password')}
                onFocus={(e) => { if (!existingUserForm.formState.errors.password) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
                onBlur={(e) => { e.currentTarget.style.border = `1px solid ${existingUserForm.formState.errors.password ? '#ff4444' : '#2a2a2a'}` }}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#555' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {existingUserForm.formState.errors.password && (
              <p className="text-xs" style={{ color: '#ff4444' }}>
                {existingUserForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" loading={existingUserForm.formState.isSubmitting} className="mt-2 w-full">
            Confirmar e entrar
          </Button>

          <p className="text-center text-xs" style={{ color: '#555' }}>
            Esqueceu sua senha?{' '}
            <button type="button" className="underline" style={{ color: '#888' }}
              onClick={() => window.location.hash = '#/login'}>
              Entre pelo login e redefina
            </button>
          </p>
        </form>
      </AuthLayout>
    )
  }

  // ── Formulário novo usuário ───────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>Você foi convidado! 🎉</h1>
        {inviteHeader}
        <p className="text-sm mt-3" style={{ color: '#666' }}>
          Crie sua senha para finalizar o cadastro.
        </p>
      </div>

      {errorBlock}

      <form onSubmit={newUserForm.handleSubmit(onSubmitNew)} className="flex flex-col gap-4">
        <Input
          label="Seu nome *"
          placeholder="Como devemos te chamar?"
          error={newUserForm.formState.errors.fullName?.message}
          {...newUserForm.register('fullName')}
        />

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
                border: `1px solid ${newUserForm.formState.errors.password ? '#ff4444' : '#2a2a2a'}`,
                color: '#e8e8e8',
              }}
              {...newUserForm.register('password')}
              onFocus={(e) => { if (!newUserForm.formState.errors.password) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
              onBlur={(e) => { e.currentTarget.style.border = `1px solid ${newUserForm.formState.errors.password ? '#ff4444' : '#2a2a2a'}` }}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#555' }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newUserForm.formState.errors.password && (
            <p className="text-xs" style={{ color: '#ff4444' }}>{newUserForm.formState.errors.password.message}</p>
          )}
        </div>

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
              border: `1px solid ${newUserForm.formState.errors.confirm ? '#ff4444' : '#2a2a2a'}`,
              color: '#e8e8e8',
            }}
            {...newUserForm.register('confirm')}
            onFocus={(e) => { if (!newUserForm.formState.errors.confirm) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
            onBlur={(e) => { e.currentTarget.style.border = `1px solid ${newUserForm.formState.errors.confirm ? '#ff4444' : '#2a2a2a'}` }}
          />
          {newUserForm.formState.errors.confirm && (
            <p className="text-xs" style={{ color: '#ff4444' }}>{newUserForm.formState.errors.confirm.message}</p>
          )}
        </div>

        <Button type="submit" loading={newUserForm.formState.isSubmitting} className="mt-2 w-full">
          Criar conta e entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
