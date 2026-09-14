import { useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, closestCorners, MouseSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  createCard, updateCard, createColumn, updateColumn, deleteColumn, reorderColumns, posicaoEntre,
  type BoardFull, type CardData, type Membro,
} from '@/services/boards'
import type { BoardColumn } from '@/types'
import { BoardColumnView } from './BoardColumnView'
import { BoardCardView } from './BoardCardView'
import { useRecarregaQuadro } from '../hooks/useBoards'

interface ColunaComCartoes { column: BoardColumn; cards: CardData[] }

interface Props {
  data:       BoardFull
  cards:      CardData[]   // já filtrados (meus / etiqueta)
  membros:    Membro[]
  onOpenCard: (card: CardData) => void
}

function montar(columns: BoardColumn[], cards: CardData[]): ColunaComCartoes[] {
  const porColuna = new Map<string, CardData[]>()
  columns.forEach((c) => porColuna.set(c.id, []))
  cards.forEach((c) => porColuna.get(c.column_id)?.push(c))
  return columns.map((column) => ({ column, cards: (porColuna.get(column.id) ?? []).sort((a, b) => a.position - b.position) }))
}

function colunaDoCartao(cols: ColunaComCartoes[], cardId: string) {
  return cols.find((c) => c.cards.some((k) => k.id === cardId))
}

// O "over" pode ser a coluna (col-<id>), a área de soltar (id) ou um cartão
// dentro dela — mesma lição do funil: sem resolver isso, arrastar por cima de
// uma coluna cheia não reordenava.
function colunaAlvo(overId: string, cols: ColunaComCartoes[]): string | null {
  if (overId.startsWith('col-')) { const id = overId.slice(4); return cols.some((c) => c.column.id === id) ? id : null }
  if (cols.some((c) => c.column.id === overId)) return overId
  return colunaDoCartao(cols, overId)?.column.id ?? null
}

export function BoardKanban({ data, cards, membros, onOpenCard }: Props) {
  const confirm    = useConfirm()
  const recarregar = useRecarregaQuadro(data.board.id)

  const [local,        setLocal]        = useState<ColunaComCartoes[] | null>(null)
  const [colunasLocal, setColunasLocal] = useState<BoardColumn[] | null>(null)
  const [cartaoAtivo,  setCartaoAtivo]  = useState<CardData | null>(null)
  const [colunaAtiva,  setColunaAtiva]  = useState<ColunaComCartoes | null>(null)
  const [novaColuna,   setNovaColuna]   = useState<string | null>(null)

  const colunas = colunasLocal ?? data.columns
  const exibir  = local ?? montar(colunas, cards)

  // Dados frescos do servidor descartam o estado otimista.
  const assinatura = cards.map((c) => `${c.id}:${c.column_id}:${c.position}`).join(',') + '|' + data.columns.map((c) => c.id + c.position).join(',')
  useEffect(() => { setLocal(null); setColunasLocal(null) }, [assinatura])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  const onDragStart = useCallback((e: DragStartEvent) => {
    const tipo = e.active.data.current?.type as string
    const base = montar(data.columns, cards)
    if (tipo === 'column') {
      const id = (e.active.id as string).slice(4)
      setColunaAtiva(base.find((c) => c.column.id === id) ?? null)
      setColunasLocal([...data.columns])
    } else {
      setCartaoAtivo((e.active.data.current?.card as CardData) ?? null)
    }
    setLocal(base)
  }, [data.columns, cards])

  const onDragOver = useCallback((e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeId = active.id as string
    const overId   = over.id   as string

    if (active.data.current?.type === 'column') {
      const cols = local ?? montar(colunas, cards)
      const alvo = colunaAlvo(overId, cols)
      if (!alvo) return
      const de   = colunas.findIndex((c) => c.id === activeId.slice(4))
      const para = colunas.findIndex((c) => c.id === alvo)
      if (de !== -1 && para !== -1 && de !== para) {
        const reordenadas = arrayMove([...colunas], de, para)
        setColunasLocal(reordenadas)
        setLocal(montar(reordenadas, cards))
      }
      return
    }

    setLocal((prev) => {
      const cols    = prev ?? montar(colunas, cards)
      const origem  = colunaDoCartao(cols, activeId)
      const destino = cols.find((c) => c.column.id === overId) ?? colunaDoCartao(cols, overId)
      if (!origem || !destino) return cols

      if (origem.column.id === destino.column.id) {
        const de   = origem.cards.findIndex((c) => c.id === activeId)
        const para = destino.cards.findIndex((c) => c.id === overId)
        if (de === -1 || para === -1 || de === para) return cols
        return cols.map((c) => c.column.id === origem.column.id ? { ...c, cards: arrayMove(c.cards, de, para) } : c)
      }

      const movido = origem.cards.find((c) => c.id === activeId)
      if (!movido) return cols
      return cols.map((c) => {
        if (c.column.id === origem.column.id) return { ...c, cards: c.cards.filter((k) => k.id !== activeId) }
        if (c.column.id === destino.column.id) {
          const idx  = c.cards.findIndex((k) => k.id === overId)
          const novo = [...c.cards]
          novo.splice(idx === -1 ? novo.length : idx, 0, { ...movido, column_id: c.column.id })
          return { ...c, cards: novo }
        }
        return c
      })
    })
  }, [colunas, cards, local])

  const onDragEnd = useCallback(async (e: DragEndEvent) => {
    const tipo = e.active.data.current?.type as string
    setCartaoAtivo(null); setColunaAtiva(null)

    if (tipo === 'column' && colunasLocal) {
      const mudou = colunasLocal.some((c, i) => data.columns[i]?.id !== c.id)
      if (mudou) {
        await reorderColumns(colunasLocal.map((c, i) => ({ id: c.id, position: i })))
        recarregar()
      } else { setColunasLocal(null); setLocal(null) }
      return
    }

    if (!local || !e.over) { setLocal(null); return }
    const activeId = e.active.id as string
    const destino  = colunaDoCartao(local, activeId)
    if (!destino) { setLocal(null); return }

    const idx      = destino.cards.findIndex((c) => c.id === activeId)
    const anterior = destino.cards[idx - 1]?.position
    const proximo  = destino.cards[idx + 1]?.position
    const original = cards.find((c) => c.id === activeId)
    const posicao  = posicaoEntre(anterior, proximo)

    if (original && original.column_id === destino.column.id && original.position === posicao) { setLocal(null); return }

    try {
      await updateCard(activeId, { column_id: destino.column.id, position: posicao })
    } finally {
      recarregar()
    }
  }, [local, colunasLocal, data.columns, cards, recarregar])

  async function adicionarCartao(columnId: string, title: string) {
    const ultimo = exibir.find((c) => c.column.id === columnId)?.cards.at(-1)?.position
    await createCard(data.board, columnId, title, posicaoEntre(ultimo, undefined))
    recarregar()
  }

  async function criarColuna() {
    const nome = novaColuna?.trim()
    setNovaColuna(null)
    if (!nome) return
    await createColumn(data.board, nome, data.columns.length)
    recarregar()
  }

  async function excluirColuna(column: BoardColumn, quantos: number) {
    const ok = await confirm({
      title: 'Excluir coluna',
      message: quantos > 0
        ? `"${column.name}" tem ${quantos} cartão(ões). Excluir a coluna apaga os cartões junto. Mova-os antes se quiser guardar.`
        : `Excluir a coluna "${column.name}"?`,
      confirmLabel: 'Excluir', danger: true,
    })
    if (!ok) return
    await deleteColumn(column.id)
    recarregar()
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
      onDragCancel={() => { setLocal(null); setColunasLocal(null); setCartaoAtivo(null); setColunaAtiva(null) }}>
      <div className="flex gap-3 items-start h-full overflow-x-auto overflow-y-hidden pb-3 px-0.5">
        <SortableContext items={colunas.map((c) => `col-${c.id}`)} strategy={horizontalListSortingStrategy}>
          {exibir.map(({ column, cards: cs }) => (
            <BoardColumnView key={column.id} column={column} cards={cs} labels={data.labels} membros={membros}
              onOpenCard={onOpenCard} onAddCard={adicionarCartao}
              onToggleCardDone={async (c) => { await updateCard(c.id, { completed_at: c.completed_at ? null : new Date().toISOString() }); recarregar() }}
              onRename={async (id, name) => { await updateColumn(id, { name }); recarregar() }}
              onToggleDone={async (id, is_done) => { await updateColumn(id, { is_done }); recarregar() }}
              onDelete={excluirColuna} />
          ))}
        </SortableContext>

        {/* Nova coluna */}
        <div className="w-[82vw] max-w-[19rem] sm:w-64 shrink-0">
          {novaColuna === null ? (
            <button onClick={() => setNovaColuna('')}
              className="w-full flex items-center gap-1.5 text-sm rounded-xl px-3 py-2.5 transition-colors hover:bg-[#141414]"
              style={{ color: '#666', border: '1px dashed #2a2a2a' }}>
              <Plus size={14} /> Nova coluna
            </button>
          ) : (
            <div className="rounded-xl p-2 flex flex-col gap-1.5" style={{ background: '#101010', border: '1px solid #1c1c1c' }}>
              <input autoFocus value={novaColuna} onChange={(e) => setNovaColuna(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') criarColuna(); if (e.key === 'Escape') setNovaColuna(null) }}
                placeholder="Nome da coluna…"
                className="w-full text-sm rounded-lg px-2.5 py-2 outline-none"
                style={{ background: '#161616', color: '#e8e8e8', border: '1px solid #333' }} />
              <div className="flex items-center gap-1.5">
                <button onClick={criarColuna} className="text-xs font-semibold rounded-md px-2.5 py-1.5" style={{ background: 'var(--tenant-primary)', color: '#000' }}>Criar</button>
                <button onClick={() => setNovaColuna(null)} className="text-xs rounded-md px-2 py-1.5 hover:bg-[#1e1e1e]" style={{ color: '#888' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {cartaoAtivo && <div className="w-72"><BoardCardView card={cartaoAtivo} labels={data.labels} membros={membros} onOpen={() => {}} overlay /></div>}
        {colunaAtiva && (
          <BoardColumnView column={colunaAtiva.column} cards={colunaAtiva.cards} labels={data.labels} membros={membros}
            onOpenCard={() => {}} onAddCard={async () => {}} onRename={() => {}} onToggleDone={() => {}} onDelete={() => {}} overlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}
