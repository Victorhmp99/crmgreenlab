import { useState, useRef, useEffect } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
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

function PipelineMenu({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const { renamePipeline, removePipeline } = usePipelineManagement()
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
    if (!confirm(`Excluir pipeline "${pipeline.name}"? Todas as etapas e cards serão removidos.`)) return
    await removePipeline.mutateAsync(pipeline.id)
    onClose()
  }

  if (editing) {
    return (
      <div className="absolute top-full left-0 mt-1 z-50 rounded-xl p-3 w-56"
        style={{ background: '#161616', border: '1px solid #2a2a2a', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full h-8 rounded-lg px-2 text-sm mb-2 focus:outline-none"
          style={{ background: '#1a1a1a', border: '1px solid var(--tenant-primary)', color: '#e8e8e8' }}
        />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_COLORS.map((c) => (
            <ColorDot key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)}
            className="flex-1 h-7 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors"
            style={{ border: '1px solid #2a2a2a', color: '#666' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <X size={11} /> Cancelar
          </button>
          <button onClick={handleSave} disabled={!name.trim() || renamePipeline.isPending}
            className="flex-1 h-7 rounded-lg text-xs flex items-center justify-center gap-1 text-black disabled:opacity-50"
            style={{ background: 'var(--tenant-primary)' }}>
            <Check size={11} /> Salvar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-full left-0 mt-1 z-50 rounded-xl py-1 w-40 text-sm"
      style={{ background: '#161616', border: '1px solid #2a2a2a', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
      <button onClick={() => setEditing(true)}
        className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
        style={{ color: '#aaa' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
        <Pencil size={13} /> Renomear
      </button>
      <button onClick={handleDelete}
        className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
        style={{ color: '#ff4444' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
        <Trash2 size={13} /> Excluir
      </button>
    </div>
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

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
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === pipeline.id ? null : pipeline.id) }}
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

              {menuOpenId === pipeline.id && (
                <PipelineMenu pipeline={pipeline} onClose={() => setMenuOpenId(null)} />
              )}
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

      {menuOpenId && <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />}
      {showCreate && <CreatePipelineModal onClose={() => setShowCreate(false)} />}
    </>
  )
}
