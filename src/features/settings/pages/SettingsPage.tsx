import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Palette, Building2, CheckCircle, Webhook, Copy, RefreshCw, Eye, EyeOff, ShieldAlert, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantStore } from '@/store/tenantStore'
import { supabase } from '@/lib/supabase'
import { ChannelManager } from '../components/ChannelManager'
import { LeadFieldsManager } from '../components/LeadFieldsManager'
import { WhatsappManager } from '../components/WhatsappManager'
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

// URL base da Edge Function (a SUPABASE_URL é pública e pode ficar aqui)
const WEBHOOK_ENDPOINT = 'https://miezatcdfldmqmxgpkwr.supabase.co/functions/v1/receive-lead'

export function SettingsPage() {
  const { tenant }                          = useAuth()
  const { isAdmin, isSuperAdmin }           = usePermissions()
  const settings                            = useTenantStore((s) => s.settings)
  const setSettings                         = useTenantStore((s) => s.setSettings)
  const [saved, setSaved]                   = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  // Estado do webhook
  const [webhookKey, setWebhookKey]         = useState<string | null>(null)
  const [showKey, setShowKey]               = useState(false)
  const [copiedField, setCopiedField]       = useState<'url' | 'key' | 'curl' | null>(null)
  const [regenerating, setRegenerating]     = useState(false)
  const [webhookError, setWebhookError]     = useState<string | null>(null)

  // Limite de empresas por gestor
  const [maxCompanies, setMaxCompanies]     = useState<string>('')
  const [savingLimit, setSavingLimit]       = useState(false)
  const [limitSaved, setLimitSaved]         = useState(false)
  const [limitError, setLimitError]         = useState<string | null>(null)

  // Modal de exclusão
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

  // Busca webhook_key e limite de empresas do tenant atual
  useEffect(() => {
    if (!tenant?.id) return
    supabase
      .from('tenant_settings')
      .select('webhook_key, max_companies_for_managers')
      .eq('tenant_id', tenant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.webhook_key) setWebhookKey(data.webhook_key)
        if (data?.max_companies_for_managers != null) {
          setMaxCompanies(String(data.max_companies_for_managers))
        }
      })
  }, [tenant?.id])

  // Copia texto para o clipboard e exibe feedback brevemente
  async function copyToClipboard(text: string, field: 'url' | 'key' | 'curl') {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // fallback silencioso
    }
  }

  // Regenera a webhook_key via RPC
  async function handleRegenerateKey() {
    if (!tenant?.id) return
    setRegenerating(true)
    setWebhookError(null)
    try {
      const { data, error } = await supabase
        .rpc('regenerate_webhook_key', { p_tenant_id: tenant.id })
      if (error) throw error
      setWebhookKey(data as string)
      setShowKey(true)
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : 'Erro ao regenerar chave.')
    } finally {
      setRegenerating(false)
    }
  }

  async function saveLimit() {
    if (!tenant?.id) return
    setSavingLimit(true)
    setLimitError(null)

    const parsed = maxCompanies.trim() === '' ? null : parseInt(maxCompanies, 10)
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) {
      setLimitError('Informe um número válido maior que zero.')
      setSavingLimit(false)
      return
    }

    const { error: err } = await supabase
      .from('tenant_settings')
      .update({ max_companies_for_managers: parsed })
      .eq('tenant_id', tenant.id)

    setSavingLimit(false)
    if (err) { setLimitError('Erro ao salvar limite.'); return }
    setLimitSaved(true)
    setTimeout(() => setLimitSaved(false), 3000)
  }

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
        webhook_key:     settings?.webhook_key ?? webhookKey ?? '',
        updated_at:      new Date().toISOString(),
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      reset(data)  // marca o form como não-sujo
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

      {/* ── Dados + Cores (único form de save) ─────────────────────────── */}
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
            <span style={{ color: '#888' }}>
              {tenant?.slug ?? '—'}
            </span>
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

      {/* ── Integração WhatsApp (Evolution API) ─────────────────────────── */}
      <WhatsappManager />

      {/* ── Controle de acesso (admin only) ─────────────────────────────── */}
      {(isAdmin || isSuperAdmin) && (
        <section className="rounded-xl p-5 flex flex-col gap-4"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={15} style={{ color: 'var(--tenant-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Controle de acesso</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Limite de empresas por gestor
            </label>
            <p className="text-xs" style={{ color: '#555' }}>
              Máximo de empresas que gestores deste tenant podem criar. Deixe em branco para ilimitado.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={maxCompanies}
                onChange={(e) => setMaxCompanies(e.target.value)}
                placeholder="Ilimitado"
                className="h-10 w-36 rounded-lg px-3 text-sm focus:outline-none"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
                onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
                onBlur={(e) => (e.currentTarget.style.border = '1px solid #2a2a2a')}
              />
              <Button
                type="button"
                loading={savingLimit}
                onClick={saveLimit}
                className="shrink-0"
              >
                <Save size={13} />
                Salvar limite
              </Button>
              {limitSaved && (
                <span className="flex items-center gap-1 text-xs" style={{ color: '#00e676' }}>
                  <CheckCircle size={13} /> Salvo!
                </span>
              )}
            </div>
            {limitError && (
              <p className="text-xs" style={{ color: '#ff4444' }}>{limitError}</p>
            )}
          </div>
        </section>
      )}

      {/* ── Webhook ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl p-5 flex flex-col gap-4"
        style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook size={15} style={{ color: 'var(--tenant-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Webhook de formulários externos</h3>
          </div>
          <button
            type="button"
            onClick={handleRegenerateKey}
            disabled={regenerating}
            title="Gerar nova chave (invalida a anterior)"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all disabled:opacity-50"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888' }}
          >
            <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
            Regenerar chave
          </button>
        </div>

        <p className="text-xs" style={{ color: '#555' }}>
          Envie um POST para este endpoint a partir de qualquer formulário externo (Meta Ads,
          Google, site próprio) e o lead será criado automaticamente no CRM.
        </p>

        {/* URL do endpoint */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            URL do endpoint
          </label>
          <div className="flex items-center gap-2">
            <span
              className="flex-1 rounded-lg px-3 py-2 text-xs font-mono truncate"
              style={{ background: '#111', border: '1px solid #1a1a1a', color: '#aaa' }}
            >
              {WEBHOOK_ENDPOINT}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(WEBHOOK_ENDPOINT, 'url')}
              className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all"
              style={{
                background: copiedField === 'url' ? 'rgba(0,230,118,0.08)' : '#1a1a1a',
                border:     copiedField === 'url' ? '1px solid rgba(0,230,118,0.3)' : '1px solid #2a2a2a',
                color:      copiedField === 'url' ? '#00e676' : '#888',
              }}
            >
              <Copy size={12} />
              {copiedField === 'url' ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Webhook Key */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Chave secreta (webhook_key)
          </label>
          <div className="flex items-center gap-2">
            <span
              className="flex-1 rounded-lg px-3 py-2 text-xs font-mono truncate"
              style={{ background: '#111', border: '1px solid #1a1a1a', color: '#aaa' }}
            >
              {webhookKey
                ? (showKey ? webhookKey : '••••••••-••••-••••-••••-••••••••••••')
                : '— carregando...'}
            </span>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs transition-all"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#555' }}
              title={showKey ? 'Ocultar' : 'Mostrar'}
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              type="button"
              onClick={() => webhookKey && copyToClipboard(webhookKey, 'key')}
              disabled={!webhookKey}
              className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all disabled:opacity-40"
              style={{
                background: copiedField === 'key' ? 'rgba(0,230,118,0.08)' : '#1a1a1a',
                border:     copiedField === 'key' ? '1px solid rgba(0,230,118,0.3)' : '1px solid #2a2a2a',
                color:      copiedField === 'key' ? '#00e676' : '#888',
              }}
            >
              <Copy size={12} />
              {copiedField === 'key' ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Exemplo de uso */}
        {webhookKey && tenant?.id && (() => {
          const curlExample = `curl -X POST ${WEBHOOK_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "tenant_id":   "${tenant.id}",
    "webhook_key": "${webhookKey}",
    "name":        "João Silva",
    "phone":       "(11) 99999-9999",
    "email":       "joao@email.com",
    "source":      "meta_ads",
    "source_campaign": "Black Friday"
  }'`

          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                  Exemplo (cURL)
                </label>
                <button
                  type="button"
                  onClick={() => copyToClipboard(curlExample, 'curl')}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all"
                  style={{
                    background: copiedField === 'curl' ? 'rgba(0,230,118,0.08)' : 'transparent',
                    border:     copiedField === 'curl' ? '1px solid rgba(0,230,118,0.3)' : '1px solid transparent',
                    color:      copiedField === 'curl' ? '#00e676' : '#555',
                  }}
                >
                  <Copy size={11} />
                  {copiedField === 'curl' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <pre
                className="rounded-lg px-4 py-3 text-xs overflow-x-auto"
                style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', color: '#888', lineHeight: 1.6 }}
              >
                {curlExample}
              </pre>
            </div>
          )
        })()}

        {webhookError && (
          <p className="text-xs rounded-lg px-3 py-2"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
            {webhookError}
          </p>
        )}

        <div className="rounded-lg px-3 py-2 text-xs"
          style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}>
          ⚠️ Mantenha a <span style={{ color: '#888' }}>webhook_key</span> em segredo.
          Qualquer pessoa com ela pode criar leads no seu CRM. Use "Regenerar chave" se suspeitar de vazamento.
        </div>
      </section>

      {/* ── Zona de perigo (admin only) ──────────────────────────────────── */}
      {(isAdmin || isSuperAdmin) && (
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
