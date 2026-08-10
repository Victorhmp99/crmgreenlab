import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GitBranch, ChevronRight, Check, ArrowRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { usePipelines, usePipelineStagesByPipeline } from '@/features/pipeline/hooks/usePipelines'
import { addLeadToPipeline, moveCard } from '@/services/pipeline'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Lead } from '@/types'

interface Props {
  lead:    Lead | null
  onClose: () => void
}

interface CurrentPosition {
  cardId: string
  stageId: string
  stageName: string
  stageColor: string
  pipelineId: string
  pipelineName: string
  pipelineColor: string
}

async function fetchLeadCurrentCard(leadId: string): Promise<CurrentPosition | null> {
  const { data: card, error: cardErr } = await supabase
    .from('pipeline_cards')
    .select('id, stage_id')
    .eq('lead_id', leadId)
    .maybeSingle()

  if (cardErr || !card) return null

  const { data: stage, error: stageErr } = await supabase
    .from('pipeline_stages')
    .select('id, name, color, pipeline_id')
    .eq('id', card.stage_id)
    .single()

  if (stageErr || !stage) return null

  const { data: pipeline, error: pipeErr } = await supabase
    .from('pipelines')
    .select('id, name, color')
    .eq('id', stage.pipeline_id)
    .single()

  if (pipeErr || !pipeline) return null

  return {
    cardId: card.id,
    stageId: stage.id,
    stageName: stage.name,
    stageColor: stage.color,
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    pipelineColor: pipeline.color,
  }
}

export function AddToPipelineModal({ lead, onClose }: Props) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const userId   = useAuthStore((s) => s.user?.id)
  const queryClient = useQueryClient()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')

  const { data: currentPos, isLoading: loadingCurrent } = useQuery({
    queryKey: ['lead-card-position', lead?.id],
    queryFn:  () => fetchLeadCurrentCard(lead!.id),
    enabled:  !!lead,
    staleTime: 0,
  })

  const { data: pipelines = [], isLoading: loadingPipelines } = usePipelines()
  const { data: stages = [], isLoading: loadingStages } = usePipelineStagesByPipeline(selectedPipelineId ?? '')

  useEffect(() => {
    if (!lead) {
      setSelectedPipelineId(null)
      setDone(false)
      setDoneMessage('')
    }
  }, [lead])

  const mutation = useMutation({
    mutationFn: async (stageId: string) => {
      if (!tenantId || !lead) throw new Error('missing')
      const stage = stages.find((s) => s.id === stageId)
      if (currentPos) {
        await moveCard(currentPos.cardId, stageId, 0, userId ?? '')
      } else {
        await addLeadToPipeline(tenantId, lead.id, stageId, 0)
      }
      return stage?.name ?? ''
    },
    onSuccess: (stageName) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead-card-position', lead?.id] })
      const action = currentPos ? 'movido para' : 'adicionado à etapa'
      setDoneMessage(`${action} ${stageName}`)
      setDone(true)
    },
  })

  function handleClose() {
    setSelectedPipelineId(null)
    setDone(false)
    setDoneMessage('')
    onClose()
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)
  const isLoading = loadingCurrent || loadingPipelines

  return (
    <Modal
      open={!!lead}
      onClose={handleClose}
      title={done ? 'Pronto!' : currentPos ? 'Mover Lead' : 'Adicionar à Pipeline'}
      description={done ? undefined : lead?.name}
      size="sm"
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,230,118,0.1)' }}>
            <Check size={24} style={{ color: '#00e676' }} />
          </div>
          <p className="text-sm text-center" style={{ color: '#e8e8e8' }}>
            <strong>{lead?.name}</strong> {doneMessage}
            {selectedPipeline && <> em <strong>{selectedPipeline.name}</strong></>}
          </p>
          <Button onClick={handleClose} className="mt-2">Fechar</Button>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : (
        <>
          {/* Banner posição atual */}
          {currentPos && !selectedPipelineId && (
            <div className="rounded-xl px-4 py-3 mb-3"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: '#888' }}>
                Posição atual
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: currentPos.pipelineColor }} />
                <span className="text-sm font-medium" style={{ color: '#e8e8e8' }}>{currentPos.pipelineName}</span>
                <ArrowRight size={12} style={{ color: '#555' }} />
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: currentPos.stageColor }} />
                <span className="text-sm" style={{ color: '#ccc' }}>{currentPos.stageName}</span>
              </div>
            </div>
          )}

          {/* Step 1: Pick pipeline */}
          {!selectedPipelineId ? (
            <div className="flex flex-col gap-1">
              {pipelines.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#555' }}>
                  Nenhuma pipeline criada.
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#555' }}>
                    {currentPos ? 'Mover para qual pipeline?' : 'Selecione a pipeline'}
                  </p>
                  {pipelines.map((p) => {
                    const isCurrent = currentPos?.pipelineId === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPipelineId(p.id)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                        style={{ border: `1px solid ${isCurrent ? 'rgba(99,102,241,0.3)' : '#1e1e1e'}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
                        <span className="flex-1 text-sm font-medium" style={{ color: '#e8e8e8' }}>{p.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] rounded-full px-2 py-0.5"
                            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                            atual
                          </span>
                        )}
                        <ChevronRight size={14} style={{ color: '#444' }} />
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedPipelineId(null)}
                className="flex items-center gap-2 text-xs font-medium mb-2 transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
              >
                ← {selectedPipeline?.name ?? 'Voltar'}
              </button>

              {/* Banner posição atual dentro do step 2 */}
              {currentPos && (
                <div className="rounded-lg px-3 py-2 mb-2"
                  style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: '#818cf8' }}>Atual:</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: currentPos.stageColor }} />
                    <span className="text-xs" style={{ color: '#aaa' }}>{currentPos.stageName}</span>
                    <span className="text-[10px]" style={{ color: '#555' }}>em {currentPos.pipelineName}</span>
                  </div>
                </div>
              )}

              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#555' }}>
                Selecione a etapa
              </p>
              {loadingStages ? (
                <div className="flex justify-center py-8"><Spinner size="md" /></div>
              ) : stages.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#555' }}>
                  Nenhuma etapa nesta pipeline.
                </p>
              ) : (
                stages.map((s) => {
                  const isCurrent = currentPos?.stageId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => { if (!isCurrent) mutation.mutate(s.id) }}
                      disabled={mutation.isPending || isCurrent}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors disabled:cursor-not-allowed"
                      style={{
                        border: `1px solid ${isCurrent ? 'rgba(99,102,241,0.3)' : '#1e1e1e'}`,
                        background: isCurrent ? 'rgba(99,102,241,0.05)' : 'transparent',
                        opacity: isCurrent ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => { if (!mutation.isPending && !isCurrent) e.currentTarget.style.background = '#1a1a1a' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isCurrent ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                    >
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-sm font-medium" style={{ color: isCurrent ? '#888' : '#e8e8e8' }}>
                        {s.name}
                      </span>
                      {isCurrent ? (
                        <span className="text-[10px] rounded-full px-2 py-0.5"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                          aqui
                        </span>
                      ) : (
                        <GitBranch size={13} style={{ color: '#444' }} />
                      )}
                    </button>
                  )
                })
              )}
              {mutation.error && (
                <p className="text-xs mt-2 rounded-lg px-3 py-2"
                  style={{ color: '#ff4444', background: 'rgba(255,68,68,0.08)' }}>
                  Erro ao {currentPos ? 'mover' : 'adicionar'}. Tente novamente.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
