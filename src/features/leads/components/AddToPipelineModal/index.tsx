import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GitBranch, ChevronRight, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { usePipelines, usePipelineStagesByPipeline } from '@/features/pipeline/hooks/usePipelines'
import { addLeadToPipeline } from '@/services/pipeline'
import { useAuthStore } from '@/store/authStore'
import type { Lead } from '@/types'

interface Props {
  lead:    Lead | null
  onClose: () => void
}

export function AddToPipelineModal({ lead, onClose }: Props) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const queryClient = useQueryClient()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [doneStageName, setDoneStageName] = useState('')

  const { data: pipelines = [], isLoading: loadingPipelines } = usePipelines()
  const { data: stages = [], isLoading: loadingStages } = usePipelineStagesByPipeline(selectedPipelineId ?? '')

  const addMutation = useMutation({
    mutationFn: async (stageId: string) => {
      if (!tenantId || !lead) throw new Error('missing')
      const stage = stages.find((s) => s.id === stageId)
      await addLeadToPipeline(tenantId, lead.id, stageId, 0)
      return stage?.name ?? ''
    },
    onSuccess: (stageName) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setDoneStageName(stageName)
      setDone(true)
    },
  })

  function handleClose() {
    setSelectedPipelineId(null)
    setDone(false)
    setDoneStageName('')
    onClose()
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)

  return (
    <Modal
      open={!!lead}
      onClose={handleClose}
      title={done ? 'Lead adicionado' : 'Adicionar à Pipeline'}
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
            <strong>{lead?.name}</strong> adicionado à etapa <strong>{doneStageName}</strong>
            {selectedPipeline && <> da pipeline <strong>{selectedPipeline.name}</strong></>}
          </p>
          <Button onClick={handleClose} className="mt-2">Fechar</Button>
        </div>
      ) : !selectedPipelineId ? (
        <div className="flex flex-col gap-1">
          {loadingPipelines ? (
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : pipelines.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#555' }}>
              Nenhuma pipeline criada.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#555' }}>
                Selecione a pipeline
              </p>
              {pipelines.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPipelineId(p.id)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                  style={{ border: '1px solid #1e1e1e' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 text-sm font-medium" style={{ color: '#e8e8e8' }}>{p.name}</span>
                  <ChevronRight size={14} style={{ color: '#444' }} />
                </button>
              ))}
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
            stages.map((s) => (
              <button
                key={s.id}
                onClick={() => addMutation.mutate(s.id)}
                disabled={addMutation.isPending}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors disabled:opacity-50"
                style={{ border: '1px solid #1e1e1e' }}
                onMouseEnter={(e) => { if (!addMutation.isPending) e.currentTarget.style.background = '#1a1a1a' }}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-sm font-medium" style={{ color: '#e8e8e8' }}>{s.name}</span>
                <GitBranch size={13} style={{ color: '#444' }} />
              </button>
            ))
          )}
          {addMutation.error && (
            <p className="text-xs mt-2 rounded-lg px-3 py-2"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.08)' }}>
              {addMutation.error instanceof Error && addMutation.error.message.includes('duplicate')
                ? 'Este lead já está nesta pipeline.'
                : 'Erro ao adicionar. Tente novamente.'}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
