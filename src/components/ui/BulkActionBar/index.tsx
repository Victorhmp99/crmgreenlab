import { Trash2, X } from 'lucide-react'

interface BulkActionBarProps {
  count:     number
  label?:    string  // singular do item (ex: "lead", "disparo")
  onCancel:  () => void
  onDelete:  () => void
  deleting?: boolean
}

export function BulkActionBar({ count, label = 'item', onCancel, onDelete, deleting = false }: BulkActionBarProps) {
  if (count === 0) return null
  return (
    <div className="sticky top-2 z-30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl"
      style={{
        background: 'rgba(0,230,118,0.08)',
        border: '1px solid rgba(0,230,118,0.3)',
        backdropFilter: 'blur(8px)',
      }}>
      <div className="flex items-center gap-2 text-sm" style={{ color: '#e8e8e8' }}>
        <span className="rounded-full px-2 py-0.5 font-semibold tabular-nums text-xs"
          style={{ background: 'var(--tenant-primary)', color: '#000' }}>
          {count}
        </span>
        <span>{label}{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onCancel} disabled={deleting}
          className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
          style={{ color: '#aaa', background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}>
          <X size={12} /> Cancelar
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="flex items-center gap-1 text-xs rounded-lg px-3 py-1.5 font-semibold transition-all disabled:opacity-40"
          style={{ background: 'rgba(255,68,68,0.15)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.4)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.15)')}>
          <Trash2 size={12} />
          {deleting ? 'Excluindo...' : `Excluir ${count}`}
        </button>
      </div>
    </div>
  )
}
