import { useState } from 'react'
import { RefreshCw, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { KanbanBoard } from '../components/KanbanBoard'
import { QuickAddLeadModal } from '../components/QuickAddLeadModal'
import { usePipelineStages } from '../hooks/usePipelineStages'
import { usePipelineCards } from '../hooks/usePipelineCards'
import { usePipelineMutations } from '../hooks/usePipelineMutations'
import { Spinner } from '@/components/ui/Spinner'

export function PipelinePage() {
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages()
  const { data: cards  = [], isLoading: cardsLoading,  refetch } = usePipelineCards()
  const { remove } = usePipelineMutations()

  const [addToStage, setAddToStage] = useState<{ id: string; name: string; position: number } | null>(null)

  const isLoading = stagesLoading || cardsLoading

  function handleAddLead(stageId: string) {
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return
    const cardsInStage = cards.filter((c) => c.card.stage_id === stageId)
    setAddToStage({ id: stageId, name: stage.name, position: cardsInStage.length })
  }

  // Abre o modal na primeira etapa disponível (botão "+ Lead" do header)
  function handleAddLeadHeader() {
    const firstStage = stages[0]
    if (!firstStage) return
    const cardsInStage = cards.filter((c) => c.card.stage_id === firstStage.id)
    setAddToStage({ id: firstStage.id, name: firstStage.name, position: cardsInStage.length })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Pipeline</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {cards.length} lead{cards.length !== 1 ? 's' : ''} no funil ·{' '}
            {stages.length} etapa{stages.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de adicionar lead rápido no header */}
          {stages.length > 0 && (
            <Button size="sm" onClick={handleAddLeadHeader}>
              <UserPlus size={14} />
              Novo Lead
            </Button>
          )}
          <button
            onClick={() => refetch()}
            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Estado vazio: sem etapas ainda */}
      {stages.length === 0 && !stagesLoading && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
            📋
          </div>
          <div>
            <p className="font-semibold text-slate-700">Nenhuma etapa configurada</p>
            <p className="text-sm text-slate-400 mt-1">
              As etapas do funil serão criadas automaticamente ao conectar o Supabase.
            </p>
          </div>
        </div>
      )}

      {/* Board */}
      {stages.length > 0 && (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="h-full min-h-[500px]">
            <KanbanBoard
              stages={stages}
              cards={cards}
              onAddLead={handleAddLead}
              onRemoveCard={(cardId) => remove.mutate(cardId)}
            />
          </div>
        </div>
      )}

      {/* Modal de adicionar / criar lead */}
      <QuickAddLeadModal
        stageId={addToStage?.id ?? null}
        stageName={addToStage?.name}
        stagePosition={addToStage?.position ?? 0}
        onClose={() => setAddToStage(null)}
      />
    </div>
  )
}
