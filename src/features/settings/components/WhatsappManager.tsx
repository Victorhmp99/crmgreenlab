import { useState, useEffect } from 'react'
import { MessageCircle, Copy, RefreshCw, Eye, EyeOff, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  useWhatsappSettings, useWhatsappMutations,
} from '@/features/whatsapp/hooks/useWhatsappSettings'
import { useLeadChannels } from '@/features/leads/hooks/useLeadChannels'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

const WEBHOOK_BASE = 'https://miezatcdfldmqmxgpkwr.supabase.co/functions/v1/receive-whatsapp'

interface Stage { id: string; name: string }

export function WhatsappManager() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { data: settings, isLoading } = useWhatsappSettings()
  const { data: channels = [] } = useLeadChannels()
  const { save, regenerateToken } = useWhatsappMutations()

  const [evolutionUrl, setEvolutionUrl] = useState('')
  const [instanceName, setInstanceName] = useState('')
  const [defaultStage, setDefaultStage] = useState('')
  const [defaultChannel, setDefaultChannel] = useState('')
  const [active, setActive] = useState(true)
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState<'url' | 'token' | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [stages, setStages] = useState<Stage[]>([])
  const [saved, setSaved] = useState(false)

  // Sincroniza com banco
  useEffect(() => {
    if (settings) {
      setEvolutionUrl(settings.evolution_url ?? '')
      setInstanceName(settings.instance_name ?? '')
      setDefaultStage(settings.default_stage_id ?? '')
      setDefaultChannel(settings.default_channel_id ?? '')
      setActive(settings.active)
    }
  }, [settings])

  // Carrega etapas de pipeline disponíveis
  useEffect(() => {
    if (!tenantId) return
    supabase
      .from('pipeline_stages')
      .select('id, name, position')
      .eq('tenant_id', tenantId)
      .order('position')
      .then(({ data }) => setStages((data ?? []) as Stage[]))
  }, [tenantId])

  const webhookUrl = settings?.webhook_token
    ? `${WEBHOOK_BASE}/${settings.webhook_token}`
    : '—'

  async function handleSave() {
    await save.mutateAsync({
      evolution_url:      evolutionUrl || null,
      instance_name:      instanceName || null,
      default_stage_id:   defaultStage || null,
      default_channel_id: defaultChannel || null,
      active,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleRegenerate() {
    if (!confirm('Regenerar token? O webhook atual deixa de funcionar e você precisa reconfigurar no Evolution.')) return
    await regenerateToken.mutateAsync()
  }

  async function copyToClipboard(text: string, field: 'url' | 'token') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    } catch {/* silencioso */}
  }

  return (
    <section className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={15} style={{ color: '#25D366' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Integração WhatsApp (Evolution API)
          </h3>
          <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
            style={active
              ? { background: 'rgba(0,230,118,0.1)', color: '#00e676' }
              : { background: 'rgba(150,150,150,0.15)', color: 'var(--text-dim)' }}>
            {active ? 'ATIVO' : 'INATIVO'}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-xs"
          style={{ color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-[var(--tenant-primary)]"
          />
          Ativar
        </label>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Receba mensagens de WhatsApp automaticamente como leads. Configure sua instância
        da Evolution apontando o webhook abaixo. Mensagens conhecidas atualizam o lead
        existente; novas viram leads novos visíveis para toda a equipe.
      </p>

      {isLoading ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>Carregando...</p>
      ) : (
        <>
          {/* URL do webhook */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              URL do webhook
            </label>
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-lg px-3 py-2 text-xs font-mono break-all"
                style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)', color: 'var(--text-muted)' }}>
                {webhookUrl}
              </span>
              <button onClick={() => copyToClipboard(webhookUrl, 'url')} disabled={!settings?.webhook_token}
                className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all disabled:opacity-40"
                style={{
                  background: copied === 'url' ? 'rgba(0,230,118,0.08)' : 'var(--bg-surface2)',
                  border:     copied === 'url' ? '1px solid rgba(0,230,118,0.3)' : '1px solid var(--border)',
                  color:      copied === 'url' ? '#00e676' : 'var(--text-muted)',
                }}>
                {copied === 'url' ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copied === 'url' ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Token (oculto) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Token de segurança
            </label>
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-lg px-3 py-2 text-xs font-mono truncate"
                style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)', color: 'var(--text-muted)' }}>
                {settings?.webhook_token
                  ? (showToken ? settings.webhook_token : '••••••••-••••-••••-••••-••••••••••••')
                  : '— sem token —'}
              </span>
              <button onClick={() => setShowToken((v) => !v)}
                className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                title={showToken ? 'Ocultar' : 'Mostrar'}>
                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button onClick={handleRegenerate} disabled={regenerateToken.isPending}
                className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                title="Regenerar (revoga o atual)">
                <RefreshCw size={13} className={regenerateToken.isPending ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Configs */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="URL da Evolution (opcional)"
              placeholder="https://evolution.seudominio.com"
              value={evolutionUrl}
              onChange={(e) => setEvolutionUrl(e.target.value)}
            />
            <Input
              label="Nome da instância (opcional)"
              placeholder="minha-empresa"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Etapa default no Pipeline"
              value={defaultStage}
              onChange={(e) => setDefaultStage(e.target.value)}
              options={[
                { value: '', label: '— Primeira etapa do pipeline —' },
                ...stages.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              label="Canal default do lead"
              value={defaultChannel}
              onChange={(e) => setDefaultChannel(e.target.value)}
              options={[
                { value: '', label: '— Sem canal —' },
                ...channels.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>

          {/* Botão salvar */}
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} loading={save.isPending}>
              Salvar configurações
            </Button>
            {saved && (
              <span className="text-xs flex items-center gap-1" style={{ color: '#00e676' }}>
                <CheckCircle size={13} /> Salvo
              </span>
            )}
          </div>

          {/* Instruções colapsáveis */}
          <button onClick={() => setShowInstructions((v) => !v)}
            className="flex items-center gap-1.5 text-xs mt-2"
            style={{ color: 'var(--text-muted)' }}>
            {showInstructions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Como configurar no Evolution API
          </button>

          {showInstructions && (
            <div className="rounded-lg px-4 py-3 text-xs space-y-2"
              style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)', color: 'var(--text-muted)' }}>
              <p><strong style={{ color: 'var(--text)' }}>1.</strong> No Evolution API, acesse sua instância.</p>
              <p><strong style={{ color: 'var(--text)' }}>2.</strong> Em <em>Webhooks</em>, adicione um webhook do tipo <code style={{ color: '#25D366' }}>messages.upsert</code>.</p>
              <p><strong style={{ color: 'var(--text)' }}>3.</strong> Cole a URL acima como destination.</p>
              <p><strong style={{ color: 'var(--text)' }}>4.</strong> Salve. A partir de agora, mensagens recebidas viram leads automaticamente.</p>
              <p className="pt-1 mt-1" style={{ borderTop: '1px solid var(--border-dim)', color: 'var(--text-dim)' }}>
                ⚠️ Mensagens enviadas (fromMe), grupos e broadcasts são <strong>ignorados</strong>. Só conversa 1:1 com cliente vira lead.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
