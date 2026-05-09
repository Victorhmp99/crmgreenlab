import { useState, useRef, useEffect } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import type { Pipeline } from '@/services/pipelineManagement'

const PRESET_COLORS = [
  '#6366F1', '#3B82F6', '#10B981', '#F59E0B',
  '#EC4899', '#EF4444', '#8B5CF6', '#14B8A6',
]

interface PipelineSelectorProps {
  pipelines:         Pipeline[]
  selectedId:        string | null
  onSelect:          (id: string) => void
}

function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('h-5 w-5 rounded-full border-2 transition-transform', selected ? 'border-white scale-110' : 'border-transparent')}
      style={{ backgroundColor: color }}
    />
  )
}

// Menu de opções por pipeline (renomear / deletar)
function PipelineMenu({
  pipeline,
  onClose,
}: {
  pipeline: Pipeline
  onClose:  () => void
}) {
  const { renamePipeline, removePipeline } = usePipelineManagement()
  const [editing, setEditing]   = useState(false)
  const [name,    setName]      = useState(pipeline.name)
  const [color,   setColor]     = useState(pipeline.color)
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
      <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-56">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full h-8 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_COLORS.map((c) => (
            <ColorDot key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="flex-1 h-7 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1">
            <X size={11} /> Cancelar
          </button>
          <button onClick={handleSave} disabled={!name.trim() || renamePipeline.isPending}
            className="flex-1 h-7 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1 disabled:opacity-50">
            <Check size={11} /> Salvar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-40 text-sm">
      <button onClick={() => setEditing(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
        <Pencil size={13} /> Renomear
      </button>
      <button onClick={handleDelete}
        className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 transition-colors">
        <Trash2 size={13} /> Excluir
      </button>
    </div>
  )
}

// Modal para criar novo pipeline
function CreatePipelineModal({ onClose }: { onClose: () => void }) {
  const { addPipeline } = usePipelineManagement()
  const [name,  setName]  = useState('')
  const [color, setColor] = useState('#6366F1')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleCreate() {
    if (!name.trim()) return
    await addPipeline.mutateAsync({ name: name.trim(), color })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-5 w-72">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Novo Pipeline</h3>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
          placeholder="Ex: Inbound, Outbound, Pós-venda..."
          className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_COLORS.map((c) => (
            <ColorDot key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={!name.trim() || addPipeline.isPending}
            className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
            {addPipeline.isPending ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PipelineSelector({ pipelines, selectedId, onSelect }: PipelineSelectorProps) {
  const [menuOpenId,   setMenuOpenId]   = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {pipelines.map((pipeline) => {
          const isActive = pipeline.id === selectedId
          return (
            <div key={pipeline.id} className="relative shrink-0">
              <div className={cn(
                'flex items-center rounded-xl transition-all',
                isActive
                  ? 'bg-white shadow-sm border border-slate-200'
                  : 'hover:bg-slate-100',
              )}>
                {/* Tab de seleção */}
                <button
                  onClick={() => onSelect(pipeline.id)}
                  className={cn(
                    'flex items-center gap-2 pl-3 pr-2 h-9 text-sm font-medium rounded-xl transition-colors',
                    isActive ? 'text-slate-800' : 'text-slate-500',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: pipeline.color }} />
                  {pipeline.name}
                </button>

                {/* Botão de menu (só no ativo) */}
                {isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === pipeline.id ? null : pipeline.id) }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 mr-1 transition-colors"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
              </div>

              {/* Menu dropdown */}
              {menuOpenId === pipeline.id && (
                <PipelineMenu
                  pipeline={pipeline}
                  onClose={() => setMenuOpenId(null)}
                />
              )}
            </div>
          )
        })}

        {/* Botão criar pipeline */}
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Plus size={14} />
          Novo
        </button>
      </div>

      {/* Fechar menu ao clicar fora */}
      {menuOpenId && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
      )}

      {showCreate && <CreatePipelineModal onClose={() => setShowCreate(false)} />}
    </>
  )
}
