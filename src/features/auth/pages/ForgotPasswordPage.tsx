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
  const [sent, setSent] = useState(false)
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
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">E-mail enviado!</h2>
            <p className="text-slate-500 text-sm mt-1">
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
          </div>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <ArrowLeft size={14} /> Voltar ao login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Recuperar senha</h1>
        <p className="text-slate-500 text-sm mt-1">
          Informe seu e-mail e enviaremos um link de redefinição.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
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
        className="mt-4 flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={14} /> Voltar ao login
      </Link>
    </AuthLayout>
  )
}
