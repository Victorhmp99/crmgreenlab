import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

const schema = z
  .object({
    password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path: ['confirm'],
  })

type ResetForm = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(schema) })

  async function onSubmit(data: ResetForm) {
    try {
      setError(null)
      await updatePassword(data.password)
      navigate('/dashboard')
    } catch {
      setError('Não foi possível redefinir a senha. O link pode ter expirado.')
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Nova senha</h1>
        <p className="text-slate-500 text-sm mt-1">Crie uma senha forte para sua conta.</p>
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
              {field === 'password' ? 'Nova senha' : 'Confirmar senha'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                className={`h-10 w-full rounded-lg border px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
          Redefinir senha
        </Button>
      </form>
    </AuthLayout>
  )
}
