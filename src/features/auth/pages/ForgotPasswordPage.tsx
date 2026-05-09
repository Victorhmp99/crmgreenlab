import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})
type ForgotForm = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(schema) })

  async function onSubmit(data: ForgotForm) {
    try {
      setError(null)
      await resetPassword(data.email)
      setSent(true)
    } catch {
      setError('Não foi possível enviar o e-mail. Tente novamente.')
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)' }}>
            <CheckCircle style={{ color: 'var(--tenant-primary)' }} size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>E-mail enviado!</h2>
            <p className="text-sm mt-1" style={{ color: '#666' }}>
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
          </div>
          <Link
            to="/login"
            className="text-sm flex items-center gap-1 transition-colors"
            style={{ color: 'var(--tenant-primary)' }}
          >
            <ArrowLeft size={14} /> Voltar ao login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8e8' }}>Recuperar senha</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>
          Informe seu e-mail e enviaremos um link de redefinição.
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
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" loading={isSubmitting} className="w-full">
          Enviar link de recuperação
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-4 flex items-center justify-center gap-1 text-sm transition-colors"
        style={{ color: '#555' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
      >
        <ArrowLeft size={14} /> Voltar ao login
      </Link>
    </AuthLayout>
  )
}
