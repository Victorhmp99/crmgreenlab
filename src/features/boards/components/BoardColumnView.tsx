import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, MoreHorizontal, Check, CheckCircle2, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardData, Membro } from '@/services/boards'
import type { BoardColumn, BoardLabel } from '@/types'
import { BoardCardView } from './BoardCardView'

interface Props {
  column:        BoardColumn
  cards:         CardData[]
  labels:        BoardLabel[]
  membros:       Membro[]
  onOpenCard:    (card: CardData) => void
  onAddCard:     (columnId: string, title: string) => Promise<void>
  onRename:      (columnId: string, name: string) => void
  onToggleDone:  (columnId: string, isDone: boolean) => void
  onDelete:      (column: BoardColumn, quantos: number) => void
  overlay?:      boolean
}

export function BoardColumnView({ column, cards, labels, membros, onOpenCard, onAddCard, onRename, onToggleDone, onDelete, overlay = false }: Props) {
  const [adicionando, setAdicionando] = useState(false)
  const [novoTitulo,  setNovoTitulo]  = useState('')
  const [editando,    setEditando]    = useState(false)
  const [nome,        setNome]        = useState(column.name)
  const [menu,        setMenu]        = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nomeRef  = useRef<HTMLInputElement>(null)
  const menuRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { if (adicionando) inputRef.current?.focus() }, [adicionando])
  useEffect(() => { if (editando) { nomeRef.current?.focus(); nomeRef.current?.select() } }, [editando])
  useEffect(() => {
    if (!menu) return
    const fecha = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', fecha)
    return () => document.removeEventListener('mousedown', fecha)
  }, [menu])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${column.id}`, data: { type: 'column', columnId: column.id },
  })
  const { setNodeRef: setDropRef } = useDroppable({ id: column.id, data: { type: 'column', columnId: column.id } })

  async function confirmarNovo() {
    const t = novoTitulo.trim()
    if (!t) { setAdicionando(false); return }
    setNovoTitulo('')
    await onAddCard(column.id, t)
    inputRef.current?.focus()
  }

  function salvarNome() {
    const n = nome.trim()
    if (n && n !== column.name) onRename(column.id, n)
    else setNome(column.name)
    setEditando(false)
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex flex-col w-[82vw] max-w-[19rem] sm:w-72 shrink-0 max-h-full', isDragging && !overlay && 'opacity-40')}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-1 mb-2 px-1 group relative">
        <div {...attributes} {...listeners}
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0 flex items-center justify-center h-7 w-5"
          style={{ color: '#555', touchAction: 'none' }} title="Arraste para reordenar">
          <GripVertical size={14} />
        </div>

        {editando ? (
          <input ref={nomeRef} value={nome} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome}
            onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); if (e.key === 'Escape') { setNome(column.name); setEditando(false) } }}
            className="flex-1 min-w-0 text-sm font-semibold rounded px-1.5 py-0.5 outline-none"
            style={{ background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #333' }} />
        ) : (
          <button onClick={() => setEditando(true)} className="flex-1 min-w-0 flex items-center gap-1.5 text-left" title="Renomear">
            {column.is_done && <CheckCircle2 size={13} style={{ color: '#00e676' }} />}
            <span className="text-sm font-semibold truncate" style={{ color: '#e8e8e8' }}>{column.name}</span>
            <span className="text-xs tabular-nums" style={{ color: '#555' }}>{cards.length}</span>
          </button>
        )}

        <button onClick={() => setMenu((m) => !m)} className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 hover:bg-[#1e1e1e]"
          style={{ color: '#666' }} title="Opções da coluna">
          <MoreHorizontal size={15} />
        </button>

        {menu && (
          <div ref={menuRef} className="absolute right-0 top-8 z-30 w-56 rounded-lg p-1 shadow-xl"
            style={{ background: '#161616', border: '1px solid #2a2a2a' }}>
            <ItemMenu icon={Pencil} onClick={() => { setMenu(false); setEditando(true) }}>Renomear</ItemMenu>
            <ItemMenu icon={column.is_done ? Check : CheckCircle2} onClick={() => { setMenu(false); onToggleDone(column.id, !column.is_done) }}>
              {column.is_done ? 'Deixar de ser "Feito"' : 'Marcar como coluna "Feito"'}
            </ItemMenu>
            <p className="px-2.5 py-1 text-[10px] leading-snug" style={{ color: '#555' }}>
              Cartão que entra na coluna "Feito" conta como concluído.
            </p>
            <div className="my-1" style={{ borderTop: '1px solid #242424' }} />
            <ItemMenu icon={Trash2} danger onClick={() => { setMenu(false); onDelete(column, cards.length) }}>Excluir coluna</ItemMenu>
          </div>
        )}
      </div>

      {/* Cartões */}
      <div ref={setDropRef} className="flex-1 min-h-[3rem] rounded-xl p-1.5 flex flex-col gap-1.5 overflow-y-auto"
        style={{ background: '#101010', border: '1px solid #1c1c1c' }}>
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <BoardCardView key={card.id} card={card} labels={labels} membros={membros} onOpen={onOpenCard} />
          ))}
        </SortableContext>

        {adicionando ? (
          <div className="flex flex-col gap-1.5 p-0.5">
            <textarea ref={inputRef} value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmarNovo() }
                if (e.key === 'Escape') { setAdicionando(false); setNovoTitulo('') }
              }}
              placeholder="Título do cartão…" rows={2}
              className="w-full text-sm rounded-lg px-2.5 py-2 outline-none resize-none"
              style={{ background: '#161616', color: '#e8e8e8', border: '1px solid #333' }} />
            <div className="flex items-center gap-1.5">
              <button onClick={confirmarNovo} className="text-xs font-semibold rounded-md px-2.5 py-1.5"
                style={{ background: 'var(--tenant-primary)', color: '#000' }}>Adicionar</button>
              <button onClick={() => { setAdicionando(false); setNovoTitulo('') }} className="text-xs rounded-md px-2 py-1.5 hover:bg-[#1e1e1e]" style={{ color: '#888' }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdicionando(true)}
            className="flex items-center gap-1.5 text-xs rounded-lg px-2 py-2 transition-colors hover:bg-[#181818]"
            style={{ color: '#666' }}>
            <Plus size={13} /> Adicionar cartão
          </button>
        )}
      </div>
    </div>
  )
}

function ItemMenu({ icon: Icon, children, onClick, danger }: { icon: React.ElementType; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 text-left text-xs rounded-md px-2.5 py-2 hover:bg-[#1e1e1e]"
      style={{ color: danger ? '#ff4444' : '#ccc' }}>
      <Icon size={13} /> {children}
    </button>
  )
}
