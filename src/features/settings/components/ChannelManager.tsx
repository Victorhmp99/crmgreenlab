import { useState } from 'react'
import { Tag, Plus, Trash2, Check, X } from 'lucide-react'
import { useLeadChannels, useLeadChannelMutations } from '@/features/leads/hooks/useLeadChannels'
import { Button } from '@/components/ui/Button'
import type { LeadChannel } from '@/types'

const PRESET_COLORS = ['#00e676','#40a0ff','#a78bfa','#fbbf24','#ec4899','#ff4444','#14B8A6','#f97316']

export function ChannelManager() {
  const { data: channels = [], isLoading } = useLeadChannels()
  const { create, update, remove } = useLeadChannelMutations()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName,   setNewName]   = useState('')
  const [newColor,  setNewColor]  = useState('#00e676')
  const [adding,    setAdding]    = useState(false)

  async function handleAdd() {
    if (!newName.trim()) return
    await create.mutateAsync({ name: newName.trim(), color: newColor })
    setNewName(''); setNewColor('#00e676'); setAdding(false)
  }

  async function handleSave(ch: LeadChannel, name: string, color: string) {
    if (!name.trim()) return
    await update.mutateAsync({ id: ch.id, data: { name: name.trim(), color } })
    setEditingId(null)
  }

  async function handleDelete(ch: LeadChannel) {
    if (!confirm(`Excluir canal "${ch.name}"? Leads vinculados ficam sem categoria.`)) return
    await remove.mutateAsync(ch.id)
  }

  return (
    <section className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={15} style={{ color: 'var(--tenant-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Canais de origem</h3>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-all"
            style={{ background: 'rgba(0,230,118,0.08)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}>
            <Plus size={12} /> Novo canal
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: '#555' }}>
        Categorize seus leads por canal de aquisição. Exemplo: Inbound (anúncios),
        Outbound (prospecção), ou qualquer outra categoria que você usa.
      </p>

      {/* Form de adicionar */}
      {adding && (
        <div className="rounded-lg p-3 flex flex-col gap-3"
          style={{ background: '#0d0d0d', border: '1px solid rgba(0,230,118,0.2)' }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Nome do canal (ex: Eventos)"
            className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid var(--tenant-primary)', color: '#e8e8e8' }}
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setNewColor(c)}
                className="h-5 w-5 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: newColor === c ? '#e8e8e8' : 'transparent',
                  transform: newColor === c ? 'scale(1.2)' : undefined,
                }} />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} loading={create.isPending} disabled={!newName.trim()}>
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <p className="text-xs text-center py-3" style={{ color: '#555' }}>Carregando...</p>
      ) : channels.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: '#555' }}>Nenhum canal criado ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {channels.map((ch) => (
            <ChannelRow key={ch.id}
              channel={ch}
              isEditing={editingId === ch.id}
              onEdit={() => setEditingId(ch.id)}
              onCancel={() => setEditingId(null)}
              onSave={(name, color) => handleSave(ch, name, color)}
              onDelete={() => handleDelete(ch)}
              saving={update.isPending}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ChannelRow({ channel, isEditing, onEdit, onCancel, onSave, onDelete, saving }: {
  channel:   LeadChannel
  isEditing: boolean
  onEdit:    () => void
  onCancel:  () => void
  onSave:    (name: string, color: string) => void
  onDelete:  () => void
  saving:    boolean
}) {
  const [name,  setName]  = useState(channel.name)
  const [color, setColor] = useState(channel.color)

  if (isEditing) {
    return (
      <div className="rounded-lg p-3 flex flex-col gap-2"
        style={{ background: '#0d0d0d', border: '1px solid rgba(0,230,118,0.2)' }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(name, color); if (e.key === 'Escape') onCancel() }}
          className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none"
          style={{ background: '#1a1a1a', border: '1px solid var(--tenant-primary)', color: '#e8e8e8' }}
        />
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className="h-5 w-5 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#e8e8e8' : 'transparent',
                transform: color === c ? 'scale(1.2)' : undefined,
              }} />
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} title="Cancelar"
            className="h-7 w-7 rounded flex items-center justify-center"
            style={{ color: '#666' }}><X size={13} /></button>
          <button onClick={() => onSave(name, color)} disabled={!name.trim() || saving} title="Salvar"
            className="h-7 w-7 rounded flex items-center justify-center disabled:opacity-40"
            style={{ color: 'var(--tenant-primary)' }}><Check size={13} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg px-3 py-2 flex items-center gap-3 group transition-all"
      style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: channel.color }} />
      <button onClick={onEdit}
        className="flex-1 text-left text-sm transition-colors"
        style={{ color: '#e8e8e8' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#e8e8e8')}>
        {channel.name}
      </button>
      <button onClick={onDelete} title="Excluir"
        className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
        style={{ color: '#666' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.08)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#666'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}>
        <Trash2 size={12} />
      </button>
    </div>
  )
}
