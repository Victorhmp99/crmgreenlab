import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, MessageCircle, Globe, Copy, Check, X, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  fetchPipelineAutomationConfig,
  linkWhatsAppToPipeline,
  updatePipelineStartStage,
} from '@/services/pipelineAutomations'
import type { PipelineStage } from '@/types'

interface Props {
  open:         boolean
  onClose:      () => void
  pipelineId:   string
  pipelineName: string
  stages:       PipelineStage[]
  startStageId: string | null
}

export function PipelineAutomationsModal({
  open, onClose, pipelineId, pipelineName, stages, startStageId,
}: Props) {
  const tenantId    = useAuthStore((s) => s.tenant?.id)
  const queryClient = useQueryClient()

  const [copied,     setCopied]     = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)
  const [waError,    setWaError]    = useState<string | null>(null)

  const { data: config, isLoading } = useQuery({
    queryKey: ['pipeline-automation-config', tenantId],
    queryFn:  () => fetchPipelineAutomationConfig(tenantId!),
    enabled:  open && !!tenantId,
  })

  // Mutation: atualiza start_stage
  const updateStartStage = useMutation({
    mutationFn: (stageId: string) => updatePipelineStartStage(pipelineId, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', tenantId] })
      setStageError(null)
    },
    onError: (e) => setStageError((e as Error).message),
  })

  // Mutation: vincula / desvincula WhatsApp
  const linkWA = useMutation({
    mutationFn: (id: string | null) => linkWhatsAppToPipeline(tenantId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-automation-config', tenantId] })
      setWaError(null)
    },
    onError: (e) => setWaError((e as Error).message),
  })

  if (!open) return null

  // URL do webhook do formulário — inclui pipeline_id para o lead cair na etapa certa
  const webhookUrl = config?.supabaseUrl
    ? `${config.supabaseUrl}/functions/v1/receive-lead`
    : null

  const webhookExample = webhookUrl && config?.webhookKey
    ? JSON.stringify({
        tenant_id:  tenantId,
        webhook_key: config.webhookKey,
        pipeline_id: pipelineId,
        name: 'Nome do Lead',
        phone: '5511999999999',
      }, null, 2)
    : null

  const waLinkedToThis  = config?.whatsappLinkedPipelineId === pipelineId
  const waLinkedToOther = config?.whatsappLinkedPipelineId !== null &&
                          config?.whatsappLinkedPipelineId !== pipelineId

  async function handleCopyUrl() {
    if (!webhookUrl) return
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyExample() {
    if (!webhookExample) return
    await navigator.clipboard.writeText(webhookExample)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-y-auto"
        style={{
          background: '#111111',
          border: '1px solid #2a2a2a',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(var(--tenant-primary-rgb,0,230,118),0.12)' }}>
              <Zap size={14} style={{ color: 'var(--tenant-primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
                Automações
              </h2>
              <p className="text-[11px]" style={{ color: '#555' }}>{pipelineName}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
            <X size={15} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 animate-spin"
              style={{ borderColor: '#2a2a2a', borderTopColor: 'var(--tenant-primary)' }} />
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-5">

            {/* ── Etapa de entrada ───────────────────────────────────────── */}
            <section className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#666' }}>
                Etapa de entrada
              </label>
              <p className="text-xs" style={{ color: '#555' }}>
                Leads que chegam via WhatsApp ou formulário entram nesta etapa automaticamente.
              </p>

              {stages.length === 0 ? (
                <p className="text-xs italic" style={{ color: '#444' }}>
                  Esta pipeline não tem etapas ainda.
                </p>
              ) : (
                <div className="relative">
                  <select
                    value={startStageId ?? ''}
                    onChange={(e) => {
                      if (e.target.value) updateStartStage.mutate(e.target.value)
                    }}
                    disabled={updateStartStage.isPending}
                    className="w-full h-9 rounded-lg pl-3 pr-8 text-sm appearance-none focus:outline-none disabled:opacity-60"
                    style={{
                      background: '#1a1a1a',
                      border: stageError ? '1px solid #ff4444' : '1px solid #2a2a2a',
                      color: '#e8e8e8',
                    }}
                  >
                    <option value="">Selecione a etapa de entrada...</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: '#555' }} />
                </div>
              )}
              {stageError && (
                <p className="text-xs" style={{ color: '#ff4444' }}>{stageError}</p>
              )}
            </section>

            <div style={{ height: 1, background: '#1e1e1e' }} />

            {/* ── WhatsApp ───────────────────────────────────────────────── */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <MessageCircle size={13} style={{ color: '#25D366' }} />
                <label className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: '#666' }}>
                  WhatsApp (Evolution API)
                </label>
              </div>
              <p className="text-xs" style={{ color: '#555' }}>
                Quando um contato enviar mensagem pelo WhatsApp conectado, o lead entra
                automaticamente na etapa de entrada desta pipeline.
              </p>

              {/* Status atual */}
              <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                style={{ background: '#161616', border: '1px solid #222' }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full"
                    style={{ background: waLinkedToThis ? '#25D366' : '#333' }} />
                  <span className="text-xs" style={{ color: waLinkedToThis ? '#e8e8e8' : '#555' }}>
                    {waLinkedToThis
                      ? 'Vinculado a esta pipeline'
                      : waLinkedToOther
                      ? 'Vinculado a outra pipeline'
                      : 'Sem vínculo'}
                  </span>
                </div>

                {waLinkedToThis ? (
                  <button
                    disabled={linkWA.isPending}
                    onClick={() => linkWA.mutate(null)}
                    className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
                    style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    {linkWA.isPending ? 'Aguarde...' : 'Desvincular'}
                  </button>
                ) : (
                  <button
                    disabled={linkWA.isPending}
                    onClick={() => linkWA.mutate(pipelineId)}
                    className="text-xs px-2.5 py-1 rounded-lg text-black transition-colors disabled:opacity-40"
                    style={{ background: 'var(--tenant-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                    {linkWA.isPending ? 'Aguarde...' : 'Vincular esta pipeline'}
                  </button>
                )}
              </div>

              {waLinkedToOther && (
                <p className="text-[11px]" style={{ color: '#666' }}>
                  ⚠️ O WhatsApp já está vinculado a outra pipeline. Vincular aqui irá transferir o vínculo.
                </p>
              )}
              {waError && <p className="text-xs" style={{ color: '#ff4444' }}>{waError}</p>}
              {!config?.whatsappActive && (
                <p className="text-[11px]" style={{ color: '#555' }}>
                  Canal WhatsApp inativo. Ative-o em Configurações → WhatsApp.
                </p>
              )}
            </section>

            <div style={{ height: 1, background: '#1e1e1e' }} />

            {/* ── Formulário externo (Webhook) ────────────────────────────── */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Globe size={13} style={{ color: '#40a0ff' }} />
                <label className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: '#666' }}>
                  Formulário externo (Webhook)
                </label>
              </div>
              <p className="text-xs" style={{ color: '#555' }}>
                Envie leads de formulários externos para esta pipeline via HTTP POST.
                Inclua <code className="px-1 rounded text-[11px]"
                  style={{ background: '#1a1a1a', color: '#e8e8e8' }}>pipeline_id</code> no body.
              </p>

              {/* Endpoint URL */}
              {webhookUrl ? (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: '#161616', border: '1px solid #222' }}>
                  <code className="flex-1 text-[11px] truncate" style={{ color: '#888' }}>
                    {webhookUrl}
                  </code>
                  <button onClick={handleCopyUrl}
                    className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                    style={{ color: '#555' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              ) : (
                <p className="text-xs" style={{ color: '#444' }}>URL não disponível.</p>
              )}

              {/* Exemplo de payload */}
              {webhookExample && (
                <div className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid #1e1e1e' }}>
                  <div className="flex items-center justify-between px-3 py-1.5"
                    style={{ background: '#0d0d0d', borderBottom: '1px solid #1e1e1e' }}>
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: '#444' }}>
                      Exemplo de payload (POST body)
                    </span>
                    <button onClick={handleCopyExample}
                      className="flex items-center gap-1 text-[10px] transition-colors"
                      style={{ color: '#444' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#888')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}>
                      {copied ? <Check size={10} /> : <Copy size={10} />}
                      Copiar
                    </button>
                  </div>
                  <pre className="px-3 py-2.5 text-[11px] overflow-x-auto"
                    style={{ color: '#888', background: '#0d0d0d' }}>
                    {webhookExample}
                  </pre>
                </div>
              )}
            </section>

          </div>
        )}
      </div>
    </div>
  )
}
