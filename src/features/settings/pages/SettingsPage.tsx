import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Palette, Building2, CheckCircle, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantStore } from '@/store/tenantStore'
import { supabase } from '@/lib/supabase'
import { ChannelManager } from '../components/ChannelManager'
import { LeadFieldsManager } from '../components/LeadFieldsManager'
import { TelefoniaCard } from '../components/TelefoniaCard'
import { DeleteTenantModal } from '@/components/layout/Sidebar/DeleteTenantModal'

const schema = z.object({
  name:            z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  primary_color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida (use #rrggbb)'),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida (use #rrggbb)'),
})
type FormData = z.infer<typeof schema>

// Paleta de cores sugeridas
const COLOR_PRESETS = [
  { label: 'Verde Neon',  primary: '#00e676', secondary: '#00c853' },
  { label: 'Azul',        primary: '#40a0ff', secondary: '#1565c0' },
  { label: 'Roxo',        primary: '#a78bfa', secondary: '#7c3aed' },
  { label: 'Rosa',        primary: '#ec4899', secondary: '#db2777' },
  { label: 'Laranja',     primary: '#f97316', secondary: '#ea580c' },
  { label: 'Ciano',       primary: '#14b8a6', secondary: '#0f766e' },
]

export function SettingsPage() {
  const { tenant }                = useAuth()
  const { isAdmin, isManager, isSuperAdmin } = usePermissions()
  const usuario                   = useAuthStore((s) => s.user)
  // Excluir a empresa e do DONO, nao de qualquer admin. O banco ja recusa
  // (migration 071); esconder o botao evita a pessoa descobrir isso na hora
  // de apertar, depois de digitar o nome da empresa.
  const souODono = !!tenant?.owner_user_id && tenant.owner_user_id === usuario?.id
  const settings                  = useTenantStore((s) => s.settings)
  const setSettings               = useTenantStore((s) => s.setSettings)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:            tenant?.name ?? '',
      primary_color:   settings?.primary_color   ?? '#00e676',
      secondary_color: settings?.secondary_color ?? '#00c853',
    },
  })

  // Preenche ao carregar dados reais
  useEffect(() => {
    if (tenant || settings) {
      reset({
        name:            tenant?.name ?? '',
        primary_color:   settings?.primary_color   ?? '#00e676',
        secondary_color: settings?.secondary_color ?? '#00c853',
      })
    }
  }, [tenant, settings, reset])

  const primaryColor   = watch('primary_color')
  const secondaryColor = watch('secondary_color')

  async function onSubmit(data: FormData) {
    if (!tenant?.id) return
    setError(null)

    try {
      // Atualiza nome do tenant
      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({ name: data.name })
        .eq('id', tenant.id)
      if (tenantErr) throw tenantErr

      // Upsert nas configurações (cria se não existir)
      const { error: settingsErr } = await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id:       tenant.id,
          primary_color:   data.primary_color,
          secondary_color: data.secondary_color,
        })
      if (settingsErr) throw settingsErr

      // Atualiza o store local para o tema mudar imediatamente
      setSettings({
        tenant_id:       tenant.id,
        primary_color:   data.primary_color,
        secondary_color: data.secondary_color,
        logo_url:        settings?.logo_url ?? null,
        custom_domain:   settings?.custom_domain ?? null,
        webhook_key:     settings?.webhook_key ?? '',
        updated_at:      new Date().toISOString(),
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      reset(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Configurações</h2>
        <p className="text-sm mt-0.5" style={{ color: '#555' }}>
          Personalize o CRM para a sua empresa
        </p>
      </div>

      {/* ── Dados + Cores ───────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* ── Dados da clínica ──────────────────────────────────────────── */}
        <section className="rounded-xl p-5 flex flex-col gap-4"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={15} style={{ color: 'var(--tenant-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Dados da clínica</h3>
          </div>

          <Input
            label="Nome da clínica"
            placeholder="Clínica Dr. Silva"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="rounded-lg px-3 py-2 text-xs"
            style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}>
            <span style={{ color: '#444' }}>Slug: </span>
            <span style={{ color: '#888' }}>{tenant?.slug ?? '—'}</span>
            <span className="ml-2" style={{ color: '#333' }}>· Plano: {tenant?.plan ?? '—'}</span>
          </div>
        </section>

        {/* ── Tema / White-label ────────────────────────────────────────── */}
        <section className="rounded-xl p-5 flex flex-col gap-4"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2 mb-1">
            <Palette size={15} style={{ color: 'var(--tenant-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Cores do tema</h3>
          </div>

          {/* Preview das cores */}
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center text-black font-bold shrink-0"
              style={{ background: primaryColor }}>
              G
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium" style={{ color: '#e8e8e8' }}>Preview</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-3 w-3 rounded-full inline-block" style={{ background: primaryColor }} />
                <span className="text-[10px]" style={{ color: '#888' }}>{primaryColor}</span>
                <span className="h-3 w-3 rounded-full inline-block" style={{ background: secondaryColor }} />
                <span className="text-[10px]" style={{ color: '#888' }}>{secondaryColor}</span>
              </div>
            </div>
          </div>

          {/* Paleta de presets */}
          <div>
            <p className="text-xs mb-2" style={{ color: '#555' }}>Paletas prontas</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setValue('primary_color',   preset.primary,   { shouldDirty: true })
                    setValue('secondary_color', preset.secondary, { shouldDirty: true })
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all"
                  style={{
                    background: primaryColor === preset.primary ? 'rgba(0,230,118,0.08)' : '#111',
                    border: primaryColor === preset.primary
                      ? '1px solid rgba(0,230,118,0.3)'
                      : '1px solid #1e1e1e',
                    color: '#aaa',
                  }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: preset.primary }} />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs de cor manual */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                Cor primária
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded-lg cursor-pointer"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', padding: '2px' }}
                  value={primaryColor}
                  onChange={(e) => setValue('primary_color', e.target.value, { shouldDirty: true })}
                />
                <input
                  type="text"
                  maxLength={7}
                  className="h-10 flex-1 rounded-lg px-3 text-sm font-mono transition-all focus:outline-none"
                  style={{ background: '#1a1a1a', border: `1px solid ${errors.primary_color ? '#ff4444' : '#2a2a2a'}`, color: '#e8e8e8' }}
                  onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
                  {...register('primary_color')}
                />
              </div>
              {errors.primary_color && (
                <p className="text-xs" style={{ color: '#ff4444' }}>{errors.primary_color.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                Cor secundária
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded-lg cursor-pointer"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', padding: '2px' }}
                  value={secondaryColor}
                  onChange={(e) => setValue('secondary_color', e.target.value, { shouldDirty: true })}
                />
                <input
                  type="text"
                  maxLength={7}
                  className="h-10 flex-1 rounded-lg px-3 text-sm font-mono transition-all focus:outline-none"
                  style={{ background: '#1a1a1a', border: `1px solid ${errors.secondary_color ? '#ff4444' : '#2a2a2a'}`, color: '#e8e8e8' }}
                  onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
                  {...register('secondary_color')}
                />
              </div>
              {errors.secondary_color && (
                <p className="text-xs" style={{ color: '#ff4444' }}>{errors.secondary_color.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Erros / sucesso ───────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
            style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}>
            <CheckCircle size={15} />
            Configurações salvas com sucesso!
          </div>
        )}

        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!isDirty && !saved}
          className="self-start"
        >
          <Save size={15} />
          Salvar configurações
        </Button>
      </form>

      {/* ── Gestão de canais de lead (Inbound/Outbound/custom) ───────────── */}
      <ChannelManager />

      {/* ── Gestão de campos personalizados do lead ─────────────────────── */}
      <LeadFieldsManager />

      {/* Telefonia: token, URL de retorno e ramal de cada vendedor.
          Gestor também configura — é ele que toca a operação da empresa.
          Restringir a admin fazia cada cliente depender de nós pra ligar. */}
      {(isManager || isAdmin || isSuperAdmin) && <TelefoniaCard />}

      {/* ── Zona de perigo (só o dono da empresa) ────────────────────────── */}
      {(souODono || isSuperAdmin) && (
        <section className="rounded-xl p-5 flex flex-col gap-4"
          style={{ background: '#140808', border: '1px solid rgba(255,68,68,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={15} style={{ color: '#ff4444' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#ff6666' }}>Zona de perigo</h3>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-4"
            style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.15)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: '#e8e8e8' }}>Excluir empresa</p>
              <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                Remove permanentemente todos os leads, usuários, dados financeiros e configurações desta empresa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: 'rgba(255,68,68,0.12)',
                border: '1px solid rgba(255,68,68,0.3)',
                color: '#ff6666',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.25)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.12)'
              }}
            >
              <Trash2 size={14} />
              Excluir empresa
            </button>
          </div>
        </section>
      )}

      {/* Modal de exclusão */}
      {showDeleteModal && (
        <DeleteTenantModal onClose={() => setShowDeleteModal(false)} />
      )}
    </div>
  )
}
