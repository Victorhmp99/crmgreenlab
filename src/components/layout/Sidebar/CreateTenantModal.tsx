import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Building2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(80, 'Nome muito longo'),
  slug: z
    .string()
    .min(2, 'Slug muito curto')
    .max(40, 'Slug muito longo')
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
})
type FormData = z.infer<typeof schema>

interface CreateTenantModalProps {
  onClose: () => void
}

// Converte nome em slug legível (ex.: "Clínica Sul" → "clinica-sul")
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateTenantModal({ onClose }: CreateTenantModalProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const user            = useAuthStore((s) => s.user)
  const switchTenant    = useAuthStore((s) => s.switchTenant)
  const setAvailableTenants = useAuthStore((s) => s.setAvailableTenants)
  const availableTenants    = useAuthStore((s) => s.availableTenants)

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const watchedName = watch('name', '')

  // Gera slug automaticamente conforme digita o nome
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setValue('name', val)
    setValue('slug', nameToSlug(val))
  }

  async function onSubmit(formData: FormData) {
    if (!user) return
    setServerError(null)

    try {
      // RPC SECURITY DEFINER: cria tenant + membership em transação atômica
      const { data, error } = await supabase.rpc('create_tenant_for_user', {
        p_name: formData.name,
        p_slug: formData.slug,
      })

      if (error) {
        // PostgrestError não é um Error nativo — extraímos a message diretamente
        setServerError(error.message ?? 'Erro ao criar empresa.')
        return
      }

      // A RPC retorna { error: string } para erros de negócio (slug, permissão, etc.)
      if (data?.error) {
        setServerError(data.error as string)
        return
      }

      const newTenant     = data.tenant     as { id: string; name: string; slug: string; plan: string; active: boolean; created_at: string }
      const newMembership = data.membership as { id: string; user_id: string; tenant_id: string; role: 'admin' | 'manager' | 'seller'; active: boolean; account_status: 'pending' | 'active' | 'blocked'; status_changed_by: string | null; status_changed_at: string | null; created_at: string }

      const newOption = { tenant: newTenant, membership: newMembership }

      // Atualiza lista de empresas disponíveis + troca para a nova
      setAvailableTenants([...availableTenants, newOption])
      switchTenant(newOption)

      // Limpa cache para que dados da nova empresa sejam buscados do zero
      queryClient.clear()

      onClose()
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Erro inesperado ao criar empresa.'
      setServerError(msg)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: '#111', border: '1px solid #2a2a2a', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <Building2 size={18} style={{ color: 'var(--tenant-primary)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#e8e8e8' }}>Nova empresa</h2>
              <p className="text-xs" style={{ color: '#555' }}>Você será admin desta empresa</p>
            </div>
          </div>
          <button onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
          >
            <X size={16} />
          </button>
        </div>

        {serverError && (
          <div className="rounded-lg px-4 py-3 text-sm"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nome da empresa *"
            placeholder="Ex.: Clínica Sorriso"
            error={errors.name?.message}
            {...register('name', { onChange: handleNameChange })}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Slug (identificador único) *
            </label>
            <input
              {...register('slug')}
              placeholder="clinica-sorriso"
              className="h-10 w-full rounded-lg px-3 text-sm focus:outline-none font-mono"
              style={{
                background: '#1a1a1a',
                border: `1px solid ${errors.slug ? '#ff4444' : '#2a2a2a'}`,
                color: '#aaa',
              }}
              onFocus={(e) => { if (!errors.slug) e.currentTarget.style.border = '1px solid var(--tenant-primary)' }}
              onBlur={(e) => { e.currentTarget.style.border = `1px solid ${errors.slug ? '#ff4444' : '#2a2a2a'}` }}
            />
            {errors.slug
              ? <p className="text-xs" style={{ color: '#ff4444' }}>{errors.slug.message}</p>
              : <p className="text-xs" style={{ color: '#555' }}>Usado na URL — não pode ser alterado depois</p>
            }
          </div>

          <div className="flex gap-3 mt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1"
              disabled={!watchedName || isSubmitting}>
              Criar empresa
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
