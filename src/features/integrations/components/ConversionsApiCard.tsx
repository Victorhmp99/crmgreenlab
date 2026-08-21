import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Radio, Check, AlertTriangle, Clock, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  saveCapiConfig, disableCapi, fetchConversionStats,
  fetchFunisParaMapear, updateStageMetaEvent,
  META_EVENTS, type MetaEvent, type MetaCredentials,
} from '@/services/metaAds'

/**
 * API de Conversões — devolve pro Meta o que aconteceu com o lead DEPOIS
 * que ele entrou.
 *
 * Sem isso a campanha de WhatsApp só aprende "quem mandou mensagem", que é o
 * evento mais barato e menos informativo do funil. Aqui a empresa liga o
 * dataset e escolhe, coluna a coluna, o que cada movimento significa.
 */
export function ConversionsApiCard({ tenantId, credentials }: {
  tenantId:    string
  credentials: MetaCredentials | null | undefined
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const [datasetInput, setDatasetInput] = useState(credentials?.datasetId ?? '')
  const [tokenInput,   setTokenInput]   = useState('')
  const [erro,         setErro]         = useState<string | null>(null)

  const ligado = !!(credentials?.datasetId && credentials?.hasCapiToken)

  const { data: stats } = useQuery({
    queryKey: ['meta-conversion-stats', tenantId],
    queryFn:  () => fetchConversionStats(tenantId),
    enabled:  !!tenantId && ligado,
    refetchInterval: 60_000,
  })

  const { data: funis = [], isLoading: funisLoading } = useQuery({
    queryKey: ['funis-para-mapear', tenantId],
    queryFn:  () => fetchFunisParaMapear(tenantId),
    enabled:  !!tenantId && ligado,
  })

  const salvar = useMutation({
    mutationFn: () => saveCapiConfig(tenantId, datasetInput, tokenInput),
    onSuccess: () => {
      setTokenInput('')
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  const desligar = useMutation({
    mutationFn: () => disableCapi(tenantId),
    onSuccess: () => {
      setDatasetInput('')
      queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] })
    },
  })

  const mapear = useMutation({
    mutationFn: ({ stageId, event }: { stageId: string; event: MetaEvent | null }) =>
      updateStageMetaEvent(stageId, event),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funis-para-mapear', tenantId] }),
  })

  function handleSalvar(e: FormEvent) {
    e.preventDefault()
    if (!datasetInput.trim()) return setErro('Informe o ID do dataset (pixel).')
    if (!credentials?.hasCapiToken && !tokenInput.trim()) {
      return setErro('Informe o token da API de Conversões.')
    }
    salvar.mutate()
  }

  const totalMapeado = funis.reduce(
    (s, f) => s + f.stages.filter((st) => st.meta_event).length, 0,
  )

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2 mb-1">
        <Radio size={15} style={{ color: ligado ? '#00e676' : '#555' }} />
        <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
          API de Conversões
        </p>
        {ligado && (
          <span className="text-[10px] rounded-full px-2 py-0.5"
            style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>ligada</span>
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: '#444' }}>
        Ensina o Meta quem virou cliente de verdade, não só quem mandou mensagem
      </p>

      {/* ── Conexão ───────────────────────────────────────────────────── */}
      <div className="rounded-lg p-3 mb-4 text-xs leading-relaxed"
        style={{ background: 'rgba(64,160,255,0.06)', border: '1px solid rgba(64,160,255,0.2)', color: '#7ab3dd' }}>
        <p className="flex items-start gap-2">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>
            O token aqui é <strong>diferente</strong> do token de leitura acima: precisa da
            permissão <code>ads_management</code>, e o <strong>pixel</strong> tem que estar
            atribuído ao usuário do sistema (não só a conta de anúncio). O ID do dataset é o
            do pixel, em Gerenciador de Eventos → Configurações.
          </span>
        </p>
      </div>

      <form onSubmit={handleSalvar} className="flex items-end gap-3 flex-wrap mb-4">
        <div className="w-52">
          <Input
            label="ID do dataset (pixel) *"
            placeholder="1234567890123456"
            value={datasetInput}
            onChange={(e) => setDatasetInput(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-56">
          <Input
            label={credentials?.hasCapiToken
              ? 'Token da CAPI (salvo — cole outro para trocar)'
              : 'Token da CAPI *'}
            type="password"
            placeholder={credentials?.hasCapiToken ? '•••••••• já salvo' : 'EAAxxxxx...'}
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
        </div>
        <Button type="submit" loading={salvar.isPending}>
          {ligado ? 'Atualizar' : 'Ligar envio'}
        </Button>
        {ligado && (
          <button
            type="button"
            onClick={async () => {
              if (await confirm({
                title: 'Desligar API de Conversões',
                message: 'O CRM para de mandar evento pro Meta. O mapa das colunas fica salvo, então religar é só recolocar dataset e token.',
                confirmLabel: 'Desligar', danger: true,
              })) desligar.mutate()
            }}
            className="text-sm h-10 transition-colors"
            style={{ color: '#ff4444' }}
          >
            Desligar
          </button>
        )}
      </form>

      {erro && (
        <p className="text-sm rounded-lg px-3 py-2 mb-4"
          style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{erro}</p>
      )}

      {/* ── Status do envio ───────────────────────────────────────────── */}
      {ligado && stats && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Pill icone={<Check size={12} />}   cor="#00e676" texto={`${stats.enviados} enviados`} />
          {stats.pendentes > 0 && (
            <Pill icone={<Clock size={12} />} cor="#fbbf24" texto={`${stats.pendentes} na fila`} />
          )}
          {stats.falhados > 0 && (
            <Pill icone={<AlertTriangle size={12} />} cor="#ff4444" texto={`${stats.falhados} falharam`} />
          )}
        </div>
      )}

      {ligado && stats?.ultimoErro && (
        <div className="rounded-lg px-3 py-2 mb-4 text-xs"
          style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}>
          <p className="font-medium mb-1" style={{ color: '#ff6666' }}>O Meta recusou o último envio:</p>
          <p className="font-mono leading-relaxed break-all" style={{ color: '#aa7777' }}>
            {stats.ultimoErro}
          </p>
        </div>
      )}

      {/* ── Mapa coluna → evento ──────────────────────────────────────── */}
      {ligado && (
        <div style={{ borderTop: '1px solid #1e1e1e' }} className="pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#666' }}>
            O que cada coluna significa ({totalMapeado} marcadas)
          </p>
          <p className="text-[11px] mb-3 leading-relaxed" style={{ color: '#555' }}>
            Coluna sem evento não manda nada — e é assim que deve ser pra "perdido" e
            "no-show": o Meta não aprende com evento negativo, o sinal de lead ruim é
            justamente a ausência.
          </p>

          {funisLoading ? (
            <div className="flex justify-center py-6"><Spinner size="md" /></div>
          ) : (
            <div className="flex flex-col gap-4">
              {funis.map((funil) => (
                <div key={funil.pipelineId}>
                  <p className="text-[11px] font-medium mb-1.5" style={{ color: '#888' }}>
                    {funil.pipelineName}
                  </p>
                  <div className="flex flex-col gap-1">
                    {funil.stages.map((stage) => (
                      <div key={stage.id}
                        className="flex items-center gap-3 px-3 py-1.5 rounded-lg"
                        style={{ border: '1px solid #1e1e1e' }}>
                        <span className="flex-1 text-xs truncate"
                          style={{ color: stage.meta_event ? '#e8e8e8' : '#777' }}>
                          {stage.name}
                        </span>
                        <select
                          value={stage.meta_event ?? ''}
                          onChange={(e) => mapear.mutate({
                            stageId: stage.id,
                            event: (e.target.value || null) as MetaEvent | null,
                          })}
                          className="text-xs rounded-lg px-2 py-1 outline-none shrink-0"
                          style={{
                            background: '#1a1a1a',
                            border: `1px solid ${stage.meta_event ? '#2f6f4f' : '#252525'}`,
                            color: stage.meta_event ? '#00e676' : '#666',
                          }}
                        >
                          <option value="">não manda nada</option>
                          {META_EVENTS.map((ev) => (
                            <option key={ev.value} value={ev.value}>{ev.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: '#555' }}>
            Cada evento sai <strong>uma vez por lead</strong>: arrastar o card de volta e
            de novo não conta duas vezes. O envio acontece em até 5 minutos.
          </p>
        </div>
      )}
    </div>
  )
}

function Pill({ icone, cor, texto }: { icone: React.ReactNode; cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1"
      style={{ background: '#1a1a1a', color: cor }}>
      {icone}{texto}
    </span>
  )
}
