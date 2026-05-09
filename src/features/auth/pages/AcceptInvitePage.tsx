import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
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
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm:  z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path:    ['confirm'],
  })
type FormData = z.infer<typeof schema>

type PageState = 'loading' | 'valid' | 'invalid' | 'needs-signup' | 'success'

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate   = useNavigate()

  const [pageState, setPageState]     = useState<PageState>('loading')
  const [inviteData, setInviteData]   = useState<{
    email: string; role: UserRole; tenantName: string
  } | null>(null)
  const [showPw, setShowPw]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!token) { setPageState('invalid'); return }

    fetchInviteByToken(token).then((data) => {
      if (!data) { setPageState('invalid'); return }
      setInviteData(data)

      // Verifica se o usuário já está autenticado
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // Já logado: aceita direto
          acceptInvite(token)
            .then(() => { setPageState('success') })
            .catch(() => setPageState('invalid'))
        } else {
          setPageState('needs-signup')
        }
      })
    })
  }, [token])

  async function onSubmit(data: FormData) {
    if (!inviteData || !token) return
    setError(null)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email:    inviteData.email,
        password: data.password,
      })
      if (signUpError) throw signUpError

      await acceptInvite(token)
      setPageState('success')

      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.')
    }
  }

  // ── Estados de UI ──────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-4 py-8">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Verificando convite...</p>
        </div>
      </AuthLayout>
    )
  }

  if (pageState === 'invalid') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Convite inválido</h2>
            <p className="text-sm text-slate-500 mt-1">
              Este link de convite expirou ou já foi utilizado.
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Ir para o login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (pageState === 'success') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={22} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Bem-vindo ao sistema!</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sua conta foi criada. Redirecionando para o dashboard...
            </p>
          </div>
          <Spinner size="sm" />
        </div>
      </AuthLayout>
    )
  }

  // needs-signup
  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Você foi convidado!</h1>
        {inviteData && (
          <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-600">
              Você foi convidado para <strong>{inviteData.tenantName}</strong> como{' '}
              <strong>{ROLE_LABELS[inviteData.role]}</strong>.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Conta: <strong>{inviteData.email}</strong>
            </p>
          </div>
        )}
        <p className="text-slate-500 text-sm mt-3">Crie sua senha para continuar.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {(['password', 'confirm'] as const).map((field) => (
          <div key={field} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              {field === 'password' ? 'Criar senha' : 'Confirmar senha'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                className={`h-10 w-full rounded-lg border px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors[field] ? 'border-red-400' : 'border-slate-200 hover:border-slate-300'
                }`}
                {...register(field)}
              />
              {field === 'password' && (
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            {errors[field] && (
              <p className="text-xs text-red-500">{errors[field]?.message}</p>
            )}
          </div>
        ))}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Criar conta e entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
