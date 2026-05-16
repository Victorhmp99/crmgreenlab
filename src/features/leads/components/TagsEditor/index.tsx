import { useState, useEffect, useRef } from 'react'
import { Tag, Plus, X } from 'lucide-react'
import { useLeadMutations } from '../../hooks/useLeadMutations'

interface TagsEditorProps {
  leadId: string
  tags:   string[]
}

export function TagsEditor({ leadId, tags }: TagsEditorProps) {
  const { update } = useLeadMutations()
  const [local, setLocal] = useState<string[]>(tags)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sincroniza estado local com props
  useEffect(() => { setLocal(tags) }, [tags])

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  async function commit(next: string[]) {
    setLocal(next)
    await update.mutateAsync({ id: leadId, data: { tags: next } })
  }

  function handleAdd() {
    const value = draft.trim()
    if (!value) { setAdding(false); setDraft(''); return }
    if (local.includes(value)) { setDraft(''); setAdding(false); return }
    commit([...local, value])
    setDraft('')
    setAdding(false)
  }

  function handleRemove(tag: string) {
    commit(local.filter((t) => t !== tag))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
    if (e.key === 'Escape') { setAdding(false); setDraft('') }
  }

  return (
    <div className="flex items-start gap-2.5">
      <Tag size={15} className="shrink-0 mt-1" style={{ color: '#555' }} />
      <div className="flex flex-wrap gap-1 flex-1">
        {local.map((tag) => (
          <span key={tag}
            className="group inline-flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1 py-0.5 transition-all"
            style={{ background: '#1e1e1e', color: '#aaa' }}>
            {tag}
            <button onClick={() => handleRemove(tag)} title="Remover tag"
              className="h-3.5 w-3.5 rounded-full flex items-center justify-center transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
              <X size={9} />
            </button>
          </span>
        ))}

        {adding ? (
          <input ref={inputRef} value={draft} type="text"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            onBlur={handleAdd}
            placeholder="Nova tag..."
            className="text-xs rounded-full px-2.5 py-0.5 focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid rgba(0,230,118,0.4)', color: '#e8e8e8', minWidth: 80 }}
          />
        ) : (
          <button onClick={() => setAdding(true)} disabled={update.isPending}
            className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition-all disabled:opacity-40"
            style={{ background: 'transparent', color: '#555', border: '1px dashed #2a2a2a' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#00e676'; e.currentTarget.style.borderColor = 'rgba(0,230,118,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#2a2a2a' }}>
            <Plus size={10} /> Tag
          </button>
        )}
      </div>
    </div>
  )
}
