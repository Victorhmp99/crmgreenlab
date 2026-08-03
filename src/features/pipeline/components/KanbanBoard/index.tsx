import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { KanbanColumn, KanbanColumnOverlay } from '../KanbanColumn'
import { KanbanCardOverlay } from '../KanbanCard'
import { usePipelineMutations } from '../../hooks/usePipelineMutations'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { usePermissions } from '@/hooks/usePermissions'
import type { KanbanCardData, ColumnData } from '@/services/pipeline'
import type { PipelineStage, Lead } from '@/types'

interface KanbanBoardProps {
  stages:       PipelineStage[]
  cards:        KanbanCardData[]
  pipelineId:   string
  onAddLead:    (stageId: string) => void
  onRemoveCard: (cardId: string) => void
  onSelectLead: (lead: Lead) => void
}

function buildColumns(stages: PipelineStage[], cards: KanbanCardData[]): ColumnData[] {
  const byStage = new Map<string, KanbanCardData[]>()
  stages.forEach((s) => byStage.set(s.id, []))
  cards.forEach((c) => {
    const col = byStage.get(c.card.stage_id)
    if (col) col.push(c)
  })
  return stages.map((stage) => ({ stage, cards: byStage.get(stage.id) ?? [] }))
}

function findColByCardId(columns: ColumnData[], cardId: string): ColumnData | undefined {
  return columns.find((col) => col.cards.some((c) => c.card.id === cardId))
}

export function KanbanBoard({ stages, cards, pipelineId, onAddLead, onRemoveCard, onSelectLead }: KanbanBoardProps) {
  const { move, reorder } = usePipelineMutations()
  const { reorderStages }  = usePipelineManagement()

  const [localColumns,  setLocalColumns]  = useState<ColumnData[] | null>(null)
  const [localStages,   setLocalStages]   = useState<PipelineStage[] | null>(null)
  const [activeCard,    setActiveCard]    = useState<KanbanCardData | null>(null)
  const [activeColumn,  setActiveColumn]  = useState<ColumnData | null>(null)
  const [overColumnId,  setOverColumnId]  = useState<string | null>(null)
  const [convertedLead, setConvertedLead] = useState<string | null>(null) // nome do lead convertido (popup)

  const displayStages  = localStages  ?? stages
  const displayColumns = localColumns ?? buildColumns(displayStages, cards)

  // Sincroniza com o servidor: sempre que os cards/etapas mudam (refetch após
  // adicionar lead, mover, etc.), descarta o estado otimista local para refletir
  // os dados frescos. Sem isso o board ficava "preso" após arrastar e não
  // mostrava novos leads adicionados pelo modal sem apertar refresh.
  const serverSignature =
    cards.map((c) => `${c.card.id}:${c.card.stage_id}:${c.card.position}`).join(',') +
    '|' + stages.map((s) => s.id).join(',')
  useEffect(() => {
    setLocalColumns(null)
    setLocalStages(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSignature])

  // IDs das colunas para o SortableContext horizontal
  const columnSortIds = displayStages.map((s) => `col-${s.id}`)

  // Mouse e Touch separados: no desktop arrasta ao mover 8px; no celular,
  // segura ~220ms (long-press) e arrasta — assim o toque curto ainda rola a
  // lista e abre o card, e o long-press move. (PointerSensor sozinho brigava
  // com o scroll no mobile.)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const type = event.active.data.current?.type as string
    if (type === 'column') {
      const stageId  = (event.active.id as string).replace('col-', '')
      const colData  = buildColumns(stages, cards).find((c) => c.stage.id === stageId)
      setActiveColumn(colData ?? null)
      setLocalStages([...stages])
      setLocalColumns(buildColumns(stages, cards))
    } else {
      const cardData = event.active.data.current?.cardData as KanbanCardData
      setActiveCard(cardData ?? null)
      setLocalColumns(buildColumns(stages, cards))
    }
  }, [stages, cards])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) { setOverColumnId(null); return }

    const activeId = active.id  as string
    const overId   = over.id    as string
    const type     = active.data.current?.type as string

    if (type === 'column') {
      // Reordena colunas em tempo real
      const activeIdx = displayStages.findIndex((s) => `col-${s.id}` === activeId)
      const overIdx   = displayStages.findIndex((s) => `col-${s.id}` === overId)
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        const reordered = arrayMove([...(localStages ?? stages)], activeIdx, overIdx)
        setLocalStages(reordered)
        setLocalColumns(buildColumns(reordered, cards))
      }
      return
    }

    // Movimentação de cards
    setLocalColumns((prev) => {
      const cols = prev ?? buildColumns(stages, cards)
      const sourceCol = findColByCardId(cols, activeId)
      const destCol   = cols.find((c) => c.stage.id === overId)
        ?? findColByCardId(cols, overId)

      if (!sourceCol || !destCol) return cols
      setOverColumnId(destCol.stage.id)

      if (sourceCol.stage.id === destCol.stage.id) {
        const oldIdx = sourceCol.cards.findIndex((c) => c.card.id === activeId)
        const newIdx = destCol.cards.findIndex((c)  => c.card.id === overId)
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return cols
        const reordered = arrayMove(sourceCol.cards, oldIdx, newIdx)
        return cols.map((col) =>
          col.stage.id === sourceCol.stage.id ? { ...col, cards: reordered } : col,
        )
      }

      const movingCard = sourceCol.cards.find((c) => c.card.id === activeId)
      if (!movingCard) return cols
      const updated = { ...movingCard, card: { ...movingCard.card, stage_id: destCol.stage.id } }

      return cols.map((col) => {
        if (col.stage.id === sourceCol.stage.id)
          return { ...col, cards: col.cards.filter((c) => c.card.id !== activeId) }
        if (col.stage.id === destCol.stage.id) {
          const overIdx   = col.cards.findIndex((c) => c.card.id === overId)
          const insertAt  = overIdx === -1 ? col.cards.length : overIdx
          const newCards  = [...col.cards]
          newCards.splice(insertAt, 0, updated)
          return { ...col, cards: newCards }
        }
        return col
      })
    })
  }, [stages, cards, displayStages, localStages])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active } = event
    const type = active.data.current?.type as string

    setActiveCard(null)
    setActiveColumn(null)
    setOverColumnId(null)

    if (type === 'column' && localStages) {
      const updates = localStages.map((s, i) => ({ id: s.id, position: i }))
      reorderStages.mutate({ updates, pipelineId })
      setLocalStages(null)
      setLocalColumns(null)
      return
    }

    if (!localColumns) return

    const { over } = event
    if (!over) { setLocalColumns(null); return }

    const activeId  = active.id as string

    // CRÍTICO: sourceCol vem do estado do SERVIDOR (antes do handleDragOver mover o card),
    // destCol vem do estado LOCAL (após o handleDragOver). Comparar local com local
    // sempre dá igual porque o card já foi movido no estado local.
    const serverColumns = buildColumns(stages, cards)
    const sourceCol     = findColByCardId(serverColumns, activeId)
    const destCol       = findColByCardId(localColumns, activeId)

    if (!sourceCol || !destCol) { setLocalColumns(null); return }

    const finalCol      = localColumns.find((c) => c.stage.id === destCol.stage.id)!
    const finalPosition = finalCol.cards.findIndex((c) => c.card.id === activeId)
    const movedCard     = finalCol.cards.find((c) => c.card.id === activeId)
      ?? sourceCol.cards.find((c) => c.card.id === activeId)

    if (!movedCard) { setLocalColumns(null); return }

    try {
      if (sourceCol.stage.id !== destCol.stage.id) {
        // 1. Move o card para a nova coluna
        await move.mutateAsync({
          cardId:        activeId,
          newStageId:    destCol.stage.id,
          newPosition:   finalPosition,
          fromStageName: sourceCol.stage.name,
          toStageName:   destCol.stage.name,
          leadId:        movedCard.lead.id,
        })

        // 1b. Auto-conversão de status conforme o tipo da etapa de destino
        const destType   = destCol.stage.stage_type ?? (destCol.stage.is_final ? 'won' : 'in_progress')
        const sourceType = sourceCol.stage.stage_type ?? (sourceCol.stage.is_final ? 'won' : 'in_progress')
        const { supabase } = await import('@/lib/supabase')
        if (destType === 'won' && movedCard.lead.status !== 'converted') {
          await supabase.from('leads')
            .update({ status: 'converted', updated_at: new Date().toISOString() })
            .eq('id', movedCard.lead.id)
          setConvertedLead(movedCard.lead.name)         // dispara o popup 🎉
          setTimeout(() => setConvertedLead(null), 5000)
        } else if (destType === 'lost' && movedCard.lead.status !== 'lost') {
          await supabase.from('leads')
            .update({ status: 'lost', updated_at: new Date().toISOString() })
            .eq('id', movedCard.lead.id)
        } else if (destType === 'in_progress' && (sourceType === 'won' || sourceType === 'lost')) {
          // Voltou de uma etapa final para andamento → reverte para ativo
          await supabase.from('leads')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', movedCard.lead.id)
        }

        // 2. Reordena coluna destino para garantir posições sequenciais únicas
        const destReorders = finalCol.cards.map((c, i) => ({ id: c.card.id, position: i }))
        await reorder.mutateAsync(destReorders)

        // 3. Reordena coluna origem também (preenche gap deixado)
        const sourceColFinal = localColumns.find((c) => c.stage.id === sourceCol.stage.id)!
        const sourceReorders = sourceColFinal.cards.map((c, i) => ({ id: c.card.id, position: i }))
        if (sourceReorders.length > 0) {
          await reorder.mutateAsync(sourceReorders)
        }
      } else {
        const serverCol = buildColumns(stages, cards).find((c) => c.stage.id === sourceCol.stage.id)
        const serverIdx = serverCol?.cards.findIndex((c) => c.card.id === activeId) ?? -1
        if (serverIdx !== finalPosition) {
          await reorder.mutateAsync(finalCol.cards.map((c, i) => ({ id: c.card.id, position: i })))
        } else {
          setLocalColumns(null)
        }
      }
    } catch (err) {
      console.error('[Pipeline] erro ao mover card:', err)
      setLocalColumns(null)
    }
  }, [localColumns, localStages, stages, cards, pipelineId, move, reorder, reorderStages])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* SortableContext horizontal para colunas */}
      <SortableContext items={columnSortIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 h-full pb-4">
          {displayColumns.map((column) => (
            <KanbanColumn
              key={column.stage.id}
              column={column}
              pipelineId={pipelineId}
              isOver={overColumnId === column.stage.id}
              onRemoveCard={onRemoveCard}
              onAddLead={onAddLead}
              onSelectLead={onSelectLead}
            />
          ))}

          {/* Botão para adicionar nova etapa */}
          <AddStageButton pipelineId={pipelineId} nextPosition={displayStages.length} />
        </div>
      </SortableContext>

      {/* Overlay durante drag */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeCard    && <KanbanCardOverlay   data={activeCard} />}
        {activeColumn  && <KanbanColumnOverlay column={activeColumn} />}
      </DragOverlay>

      {/* 🎉 Popup de conversão (venda fechada) */}
      {convertedLead && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{
            background:  '#0d0d0d',
            border:      '1px solid rgba(0,230,118,0.45)',
            boxShadow:   '0 8px 40px rgba(0,230,118,0.25)',
            animation:   'fadeIn 0.25s ease',
          }}
        >
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-sm font-bold" style={{ color: '#00e676' }}>
              Parabéns pela venda!
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#aaa' }}>
              <strong style={{ color: '#e8e8e8' }}>{convertedLead}</strong> foi convertido com sucesso.
            </p>
          </div>
        </div>
      )}
    </DndContext>
  )
}

// Botão "+ Nova Etapa" no final do board
function AddStageButton({ pipelineId, nextPosition }: { pipelineId: string; nextPosition: number }) {
  const [adding, setAdding]   = useState(false)
  const [name,   setName]     = useState('')
  const [color,  setColor]    = useState('#94a3b8')
  const { addStage }          = usePipelineManagement()
  const confirm               = useConfirm()
  const { isManager }         = usePermissions()
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Vendedor não pode criar etapas (RLS bloqueia) — mostra aviso estilizado
  // em vez de falhar em silêncio.
  function startAdding() {
    if (!isManager) {
      confirm({
        variant: 'alert',
        title: 'Sem permissão',
        message: 'Você não tem permissão para criar etapas na pipeline. Peça a um gestor ou administrador.',
      })
      return
    }
    setAdding(true)
  }

  const COLORS = ['#00e676','#40a0ff','#a78bfa','#fbbf24','#ec4899','#ff4444','#555']

  async function handleAdd() {
    if (!name.trim()) return
    await addStage.mutateAsync({ pipelineId, name: name.trim(), color, position: nextPosition })
    setName('')
    setColor('#94a3b8')
    setAdding(false)
  }

  if (!adding) {
    return (
      <button
        onClick={startAdding}
        className="shrink-0 flex flex-col items-center justify-center w-52 rounded-xl gap-1.5 py-6 transition-all"
        style={{ border: '2px dashed #1e1e1e', color: '#444' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,230,118,0.3)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#00e676'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e1e'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#444'
        }}
      >
        <Plus size={18} />
        <span className="text-xs font-medium">Nova etapa</span>
      </button>
    )
  }

  return (
    <div className="shrink-0 w-52 rounded-xl p-3 flex flex-col gap-2"
      style={{ border: '1px solid rgba(0,230,118,0.3)', background: 'rgba(0,230,118,0.04)' }}>
      <input
        ref={(el) => { (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el; el?.focus() }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
        placeholder="Nome da etapa..."
        className="h-8 w-full rounded-lg px-2 text-sm focus:outline-none"
        style={{ background: '#1a1a1a', border: '1px solid var(--tenant-primary)', color: '#e8e8e8' }}
      />
      <div className="flex gap-1.5 flex-wrap">
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)}
            className="h-4 w-4 rounded-full border-2 transition-transform"
            style={{ backgroundColor: c, borderColor: color === c ? '#e8e8e8' : 'transparent', transform: color === c ? 'scale(1.25)' : undefined }} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setAdding(false)}
          className="flex-1 h-7 rounded-lg text-xs transition-colors"
          style={{ border: '1px solid #2a2a2a', color: '#666' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          Cancelar
        </button>
        <button onClick={handleAdd} disabled={!name.trim() || addStage.isPending}
          className="flex-1 h-7 rounded-lg text-xs text-black disabled:opacity-50"
          style={{ background: 'var(--tenant-primary)' }}>
          Adicionar
        </button>
      </div>
    </div>
  )
}
