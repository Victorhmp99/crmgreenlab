import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
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
    <div className="min-h-screen login-bg relative overflow-hidden">
      {/* Grid de fundo */}
      <div className="absolute inset-0 login-grid pointer-events-none" />

      {/* Orbes neon flutuantes */}
      <div className="absolute top-[10%] left-[15%] h-72 w-72 rounded-full blur-3xl pointer-events-none login-orb-1"
        style={{ background: '#00ff66' }} />
      <div className="absolute bottom-[15%] right-[10%] h-96 w-96 rounded-full blur-3xl pointer-events-none login-orb-2"
        style={{ background: '#00e6a8' }} />
      <div className="absolute top-[50%] left-[60%] h-64 w-64 rounded-full blur-3xl pointer-events-none login-orb-3"
        style={{ background: '#00c853' }} />

      {/* Partículas piscando */}
      <Particles />

      {/* Linha de scan diagonal */}
      <div className="login-scan" />

      {/* Conteúdo */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Lado esquerdo: logo + slogan */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Logo + Intelligence Platform */}
            <div className="flex flex-col items-center lg:items-start mb-8">
              <div className="relative mb-3">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Green Hub" className="h-28 w-28 object-contain" />
                <div className="absolute inset-0 blur-xl opacity-50 pointer-events-none">
                  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-28 w-28 object-contain" />
                </div>
              </div>
              <p className="text-xs tracking-[0.3em] uppercase"
                style={{ color: '#00c853', opacity: 0.7 }}>
                Intelligence Platform
              </p>
            </div>

            {/* Slogan principal */}
            <div className="max-w-md">
              <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-3"
                style={{ color: '#e8e8e8' }}>
                Bem-vindo à{' '}
                <span className="neon-flicker" style={{ color: '#00ff88' }}>Green Hub</span>
              </h2>
              <p className="text-base leading-relaxed mb-2"
                style={{ color: '#aaa' }}>
                Inteligência, automação e controle em um só lugar.
              </p>
              <p className="text-base leading-relaxed"
                style={{ color: '#888' }}>
                Acesse sua conta e transforme dados em decisões estratégicas.
              </p>
            </div>
          </div>

          {/* Lado direito: form */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <div className="rounded-2xl p-8 login-card backdrop-blur-sm"
              style={{
                background: 'rgba(8, 16, 12, 0.7)',
                border: '1px solid rgba(0, 230, 118, 0.2)',
              }}>
              <div className="mb-6">
                <h3 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>
                  Acessar painel
                </h3>
                <p className="text-sm mt-1" style={{ color: '#666' }}>
                  Entre com suas credenciais
                </p>
              </div>

              {authError && (
                <div className="mb-4 rounded-lg px-4 py-3 text-sm"
                  style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)', color: '#ff4444' }}>
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
                    <Link to="/forgot-password" className="text-xs transition-colors"
                      style={{ color: '#00ff88' }}>
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
                        background: 'rgba(20, 30, 24, 0.6)',
                        border: `1px solid ${errors.password ? '#ff4444' : 'rgba(0, 230, 118, 0.2)'}`,
                        color: '#e8e8e8',
                      }}
                      onFocus={(e) => {
                        if (!errors.password) e.currentTarget.style.border = '1px solid #00ff88'
                      }}
                      {...register('password', {
                        onBlur: (e) => {
                          if (!errors.password) e.currentTarget.style.border = '1px solid rgba(0, 230, 118, 0.2)'
                        },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: '#555' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#00ff88')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs" style={{ color: '#ff4444' }}>{errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" loading={isSubmitting} className="mt-2 w-full neon-pulse">
                  Entrar
                </Button>
              </form>

              <p className="mt-5 text-center text-sm" style={{ color: '#555' }}>
                Primeira vez?{' '}
                <Link to="/registrar" className="font-medium transition-colors"
                  style={{ color: '#00ff88' }}>
                  Criar conta gratuitamente
                </Link>
              </p>
            </div>

            <p className="text-center text-[11px] mt-6" style={{ color: '#444' }}>
              © {new Date().getFullYear()} Green Hub · Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Partículas piscando aleatoriamente pelo fundo
function Particles() {
  const positions = [
    { top: '12%', left: '8%',  delay: '0s'   },
    { top: '25%', left: '85%', delay: '0.8s' },
    { top: '40%', left: '20%', delay: '1.5s' },
    { top: '55%', left: '92%', delay: '2.2s' },
    { top: '70%', left: '15%', delay: '0.4s' },
    { top: '85%', left: '78%', delay: '1.1s' },
    { top: '15%', left: '55%', delay: '1.8s' },
    { top: '45%', left: '45%', delay: '2.5s' },
    { top: '78%', left: '40%', delay: '0.6s' },
    { top: '32%', left: '70%', delay: '1.3s' },
    { top: '60%', left: '5%',  delay: '2.0s' },
    { top: '90%', left: '50%', delay: '0.2s' },
  ]
  return (
    <>
      {positions.map((p, i) => (
        <span key={i} className="particle"
          style={{ top: p.top, left: p.left, animationDelay: p.delay }} />
      ))}
    </>
  )
}
