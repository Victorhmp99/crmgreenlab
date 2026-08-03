import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { Pipeline } from '@/services/pipelineManagement'

const PRESET_COLORS = [
  '#00e676','#40a0ff','#a78bfa','#fbbf24',
  '#ec4899','#ff4444','#14B8A6','#f97316',
]

interface PipelineSelectorProps {
  pipelines:  Pipeline[]
  selectedId: string | null
  onSelect:   (id: string) => void
}

function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-5 w-5 rounded-full border-2 transition-transform"
      style={{
        backgroundColor: color,
        borderColor: selected ? '#e8e8e8' : 'transparent',
        transform: selected ? 'scale(1.15)' : undefined,
      }}
    />
  )
}

function PipelineMenu({ pipeline, anchorRect, onClose }: {
  pipeline:   Pipeline
  anchorRect: DOMRect
  onClose:    () => void
}) {
  const { renamePipeline, removePipeline } = usePipelineManagement()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [name,    setName]    = useState(pipeline.name)
  const [color,   setColor]   = useState(pipeline.color)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function handleSave() {
    if (!name.trim()) return
    await renamePipeline.mutateAsync({ id: pipeline.id, name: name.trim(), color })
    setEditing(false)
    onClose()
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Excluir pipeline',
      message: `Excluir pipeline "${pipeline.name}"? Todas as etapas e cards serão removidos.`,
      confirmLabel: 'Excluir', danger: true,
    })
    if (!ok) return
    await removePipeline.mutateAsync(pipeline.id)
    onClose()
  }

  // Posiciona o menu logo abaixo do botão de "..." (anchor)
  const top  = anchorRect.bottom + 4 + window.scrollY
  const left = Math.max(8, anchorRect.left + window.scrollX - 80) // alinha à esquerda do botão

  return createPortal(
    <>
      {/* Overlay clicável pra fechar */}
      <div className="fixed inset-0 z-[1000]" onClick={onClose} />

      {/* Menu */}
      <div className="fixed z-[1001] rounded-xl"
        style={{
          top, left,
          background: '#161616',
          border: '1px solid #2a2a2a',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          minWidth: editing ? 224 : 160,
        }}
        onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <div className="p-3 flex flex-col gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full h-8 rounded-lg px-2 text-sm focus:outline-none"
              style={{ background: '#1a1a1a', border: '1px solid var(--tenant-primary)', color: '#e8e8e8' }}
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <ColorDot key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)}
                className="flex-1 h-7 rounded-lg text-xs flex items-center justify-center gap-1"
                style={{ border: '1px solid #2a2a2a', color: '#666' }}>
                <X size={11} /> Cancelar
              </button>
              <button onClick={handleSave} disabled={!name.trim() || renamePipeline.isPending}
                className="flex-1 h-7 rounded-lg text-xs flex items-center justify-center gap-1 text-black disabled:opacity-50"
                style={{ background: 'var(--tenant-primary)' }}>
                <Check size={11} /> Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="py-1">
            <button onClick={() => setEditing(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
              style={{ color: '#aaa' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <Pencil size={13} /> Renomear
            </button>
            <button onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
              style={{ color: '#ff4444' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

function CreatePipelineModal({ onClose }: { onClose: () => void }) {
  const { addPipeline } = usePipelineManagement()
  const [name,  setName]  = useState('')
  const [color, setColor] = useState('#00e676')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleCreate() {
    if (!name.trim()) return
    await addPipeline.mutateAsync({ name: name.trim(), color })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      <div className="relative z-10 rounded-2xl p-5 w-72"
        style={{ background: '#111111', border: '1px solid #2a2a2a', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#e8e8e8' }}>Novo Pipeline</h3>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
          placeholder="Ex: Inbound, Outbound, Pós-venda..."
          className="w-full h-9 rounded-lg px-3 text-sm mb-3 focus:outline-none"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
          onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
          onBlur={(e) => (e.currentTarget.style.border = '1px solid #2a2a2a')}
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_COLORS.map((c) => (
            <ColorDot key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg text-sm transition-colors"
            style={{ border: '1px solid #2a2a2a', color: '#666' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={!name.trim() || addPipeline.isPending}
            className="flex-1 h-9 rounded-lg text-sm text-black disabled:opacity-50"
            style={{ background: 'var(--tenant-primary)' }}>
            {addPipeline.isPending ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PipelineSelector({ pipelines, selectedId, onSelect }: PipelineSelectorProps) {
  const [menuState, setMenuState] = useState<{ pipeline: Pipeline; rect: DOMRect } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  function openMenu(pipeline: Pipeline, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuState((prev) =>
      prev?.pipeline.id === pipeline.id ? null : { pipeline, rect },
    )
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {pipelines.map((pipeline) => {
          const isActive = pipeline.id === selectedId
          return (
            <div key={pipeline.id} className="relative shrink-0">
              <div
                className="flex items-center rounded-xl transition-all"
                style={isActive ? { background: '#1e1e1e', border: '1px solid #2a2a2a' } : undefined}
              >
                <button
                  onClick={() => onSelect(pipeline.id)}
                  className="flex items-center gap-2 pl-3 pr-2 h-9 text-sm font-medium rounded-xl transition-colors"
                  style={{ color: isActive ? '#e8e8e8' : '#555' }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget.style.color = '#aaa') }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget.style.color = '#555') }}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: pipeline.color }} />
                  {pipeline.name}
                </button>

                {isActive && (
                  <button
                    onClick={(e) => openMenu(pipeline, e)}
                    title="Renomear ou excluir pipeline"
                    className="h-7 w-7 rounded-lg flex items-center justify-center mr-1 transition-colors"
                    style={{ color: '#555' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#aaa'
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#555'
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm transition-colors"
          style={{ color: '#444' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,230,118,0.06)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#444'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <Plus size={14} />
          Novo
        </button>
      </div>

      {menuState && (
        <PipelineMenu
          pipeline={menuState.pipeline}
          anchorRect={menuState.rect}
          onClose={() => setMenuState(null)}
        />
      )}
      {showCreate && <CreatePipelineModal onClose={() => setShowCreate(false)} />}
    </>
  )
}
