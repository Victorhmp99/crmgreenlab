import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'

const schema = z
  .object({
    password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
    confirm:  z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path:    ['confirm'],
  })

type ResetForm = z.infer<typeof schema>
type PageState = 'verifying' | 'ready' | 'invalid' | 'success'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>('verifying')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(schema) })

  // Garante que existe uma sessão de recovery antes de permitir trocar a senha
  // Com flowType: 'pkce', o Supabase SDK detecta o ?code= na URL automaticamente
  // e estabelece a sessão. Damos um tempo curto para isso acontecer.
  useEffect(() => {
    let cancelled = false

    async function verifySession() {
      // Aguarda até 2 segundos pelo Supabase processar a URL
      for (let attempt = 0; attempt < 20; attempt++) {
        if (cancelled) return
        const { data } = await supabase.auth.getSession()
        if (data.session) { setPageState('ready'); return }
        await new Promise((r) => setTimeout(r, 100))
      }

      // Se há um ?code= mas a sessão não estabeleceu, tenta o exchange manualmente
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')

      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (!cancelled) {
          if (exchangeErr) {
            setError('Link expirado ou inválido. Solicite um novo link de recuperação.')
            setPageState('invalid')
          } else {
            setPageState('ready')
          }
        }
        return
      }

      if (!cancelled) {
        setError('Nenhum link de recuperação detectado. Use o link enviado para seu e-mail.')
        setPageState('invalid')
      }
    }

    verifySession()
    return () => { cancelled = true }
  }, [])

  async function onSubmit(data: ResetForm) {
    setError(null)
    const { error: updateErr } = await supabase.auth.updateUser({ password: data.password })

    if (updateErr) {
      const msg = updateErr.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('invalid')) {
        setError('O link de recuperação expirou. Solicite um novo.')
      } else if (msg.includes('same as')) {
        setError('A nova senha deve ser diferente da senha atual.')
      } else {
        setError('Não foi possível redefinir a senha. Tente novamente.')
      }
      return
    }

    setPageState('success')
    setTimeout(() => navigate('/dashboard'), 1800)
  }

  // ── Verificando link ──────────────────────────────────────────────────────
  if (pageState === 'verifying') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-4 py-8">
          <Spinner size="lg" />
          <p className="text-sm" style={{ color: '#666' }}>Verificando link de recuperação...</p>
        </div>
      </AuthLayout>
    )
  }

  // ── Link inválido / expirado ──────────────────────────────────────────────
  if (pageState === 'invalid') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)' }}>
            <AlertTriangle size={22} style={{ color: '#ff4444' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#e8e8e8' }}>Link inválido</h2>
            <p className="text-sm mt-1" style={{ color: '#666' }}>
              {error ?? 'Este link expirou ou já foi utilizado.'}
            </p>
          </div>
          <Link to="/forgot-password" className="text-sm flex items-center gap-1"
            style={{ color: 'var(--tenant-primary)' }}>
            <ArrowLeft size={14} /> Solicitar novo link
          </Link>
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
            <h2 className="text-lg font-bold" style={{ color: '#e8e8e8' }}>Senha redefinida!</h2>
            <p className="text-sm mt-1" style={{ color: '#666' }}>
              Redirecionando para o dashboard...
            </p>
          </div>
          <Spinner size="sm" />
        </div>
      </AuthLayout>
    )
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>Nova senha</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Crie uma senha forte para sua conta.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {(['password', 'confirm'] as const).map((field) => (
          <div key={field} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              {field === 'password' ? 'Nova senha' : 'Confirmar senha'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                className="h-10 w-full rounded-lg px-3 pr-10 text-sm transition-all duration-150 focus:outline-none"
                style={{
                  background: '#1a1a1a',
                  border:     `1px solid ${errors[field] ? '#ff4444' : '#2a2a2a'}`,
                  color:      '#e8e8e8',
                }}
                onFocus={(e) => {
                  if (!errors[field]) e.currentTarget.style.border = '1px solid var(--tenant-primary)'
                }}
                {...register(field)}
              />
              {field === 'password' && (
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#555' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            {errors[field] && (
              <p className="text-xs" style={{ color: '#ff4444' }}>{errors[field]?.message}</p>
            )}
          </div>
        ))}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Redefinir senha
        </Button>
      </form>
    </AuthLayout>
  )
}
