import { useState, useEffect, useRef } from 'react'
import { Tag, Plus, X, Check, Search } from 'lucide-react'
import { useTagDefinitions, useLeadTags, useTagMutations } from '../../hooks/useLeadTags'
import { Spinner } from '@/components/ui/Spinner'
import type { LeadTagDefinition } from '@/types'

interface TagPickerProps {
  leadId:    string
  readonly?: boolean   // se true, só mostra as tags sem permitir editar
}

const TAG_COLORS = [
  '#888888', '#40a0ff', '#a78bfa', '#fbbf24',
  '#ec4899', '#ff4444', '#14B8A6', '#f97316',
  '#00e676', '#06b6d4',
]

export function TagPicker({ leadId, readonly = false }: TagPickerProps) {
  const { data: allTags = [],  isLoading: loadingAll }  = useTagDefinitions()
  const { data: leadTags = [], isLoading: loadingLead } = useLeadTags(leadId)
  const { create, sync } = useTagMutations(leadId)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TAG_COLORS[1])
  const popoverRef = useRef<HTMLDivElement>(null)

  // Fecha popover ao clicar fora
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false); setCreating(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const linkedIds = new Set(leadTags.map((t) => t.id))
  const filteredTags = search
    ? allTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : allTags

  async function toggleTag(tag: LeadTagDefinition) {
    const next = linkedIds.has(tag.id)
      ? leadTags.filter((t) => t.id !== tag.id).map((t) => t.id)
      : [...leadTags.map((t) => t.id), tag.id]
    await sync.mutateAsync(next)
  }

  async function removeTag(tagId: string) {
    const next = leadTags.filter((t) => t.id !== tagId).map((t) => t.id)
    await sync.mutateAsync(next)
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    const created = await create.mutateAsync({ name, color: newColor })
    // Já vincula ao lead
    await sync.mutateAsync([...leadTags.map((t) => t.id), created.id])
    setNewName(''); setNewColor(TAG_COLORS[1]); setCreating(false); setSearch('')
  }

  if (loadingLead) {
    return <div className="flex items-center gap-2 text-xs" style={{ color: '#666' }}><Spinner size="sm" /> Carregando tags...</div>
  }

  return (
    <div className="flex items-start gap-2.5">
      <Tag size={15} className="shrink-0 mt-1" style={{ color: '#555' }} />
      <div className="flex flex-wrap gap-1.5 flex-1 relative">
        {leadTags.map((tag) => (
          <span key={tag.id}
            className="group inline-flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1 py-0.5"
            style={{
              background: `${tag.color}22`,
              color: tag.color,
              border: `1px solid ${tag.color}55`,
            }}>
            {tag.name}
            {!readonly && (
              <button onClick={() => removeTag(tag.id)} title="Remover"
                className="h-3.5 w-3.5 rounded-full flex items-center justify-center"
                style={{ color: tag.color, opacity: 0.6 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}>
                <X size={9} />
              </button>
            )}
          </span>
        ))}

        {!readonly && (
          <button onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition-all"
            style={{ background: 'transparent', color: '#555', border: '1px dashed #2a2a2a' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#00e676'; e.currentTarget.style.borderColor = 'rgba(0,230,118,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#2a2a2a' }}>
            <Plus size={10} /> Tag
          </button>
        )}

        {/* Popover */}
        {open && (
          <div ref={popoverRef}
            className="absolute z-30 top-full left-0 mt-1.5 w-72 rounded-xl shadow-2xl p-2 flex flex-col gap-2"
            style={{ background: '#141414', border: '1px solid #2a2a2a' }}>
            {!creating ? (
              <>
                <div className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }}>
                  <Search size={12} style={{ color: '#555' }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar ou criar tag..."
                    className="flex-1 text-xs bg-transparent focus:outline-none"
                    style={{ color: '#e8e8e8' }}
                    autoFocus
                  />
                </div>

                <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5">
                  {loadingAll ? (
                    <div className="flex justify-center py-3"><Spinner size="sm" /></div>
                  ) : filteredTags.length === 0 ? (
                    <p className="text-xs text-center py-2" style={{ color: '#555' }}>Nenhuma tag</p>
                  ) : (
                    filteredTags.map((tag) => {
                      const linked = linkedIds.has(tag.id)
                      return (
                        <button key={tag.id} onClick={() => toggleTag(tag)}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
                          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}>
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: tag.color }} />
                          <span className="text-xs flex-1 truncate" style={{ color: '#e8e8e8' }}>{tag.name}</span>
                          {linked && <Check size={12} style={{ color: '#00e676' }} />}
                        </button>
                      )
                    })
                  )}
                </div>

                <button onClick={() => { setCreating(true); setNewName(search) }}
                  className="flex items-center gap-1.5 text-xs rounded-md px-2 py-1.5 transition-colors"
                  style={{ background: 'rgba(0,230,118,0.08)', color: '#00e676' }}>
                  <Plus size={11} /> Criar nova tag{search ? ` "${search}"` : ''}
                </button>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase font-semibold tracking-widest px-1" style={{ color: '#555' }}>
                  Nova tag
                </p>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome da tag"
                  autoFocus
                  className="rounded-lg px-2.5 py-1.5 text-sm focus:outline-none"
                  style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
                />
                <div className="flex flex-wrap gap-1.5 p-1">
                  {TAG_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className="h-6 w-6 rounded-full transition-transform"
                      style={{
                        background: c,
                        border: newColor === c ? '2px solid #fff' : '2px solid transparent',
                        transform: newColor === c ? 'scale(1.15)' : undefined,
                      }} />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setCreating(false)}
                    className="flex-1 text-xs rounded-md px-2 py-1.5"
                    style={{ color: '#666' }}>
                    Cancelar
                  </button>
                  <button onClick={handleCreate} disabled={!newName.trim() || create.isPending}
                    className="flex-1 text-xs rounded-md px-2 py-1.5 font-medium disabled:opacity-40"
                    style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>
                    <Check size={11} className="inline mr-1" />
                    Criar e vincular
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
