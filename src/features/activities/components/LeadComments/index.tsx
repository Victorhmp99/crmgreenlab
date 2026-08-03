import { useState } from 'react'
import { Send, Trash2, Pencil, Check, X, MessageSquare } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { useLeadComments, useLeadCommentMutations } from '../../hooks/useLeadComments'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { formatDistanceToNow } from '@/lib/dateUtils'
import type { LeadComment } from '@/services/leadComments'

interface LeadCommentsProps {
  leadId: string
}

export function LeadComments({ leadId }: LeadCommentsProps) {
  const { data: comments = [], isLoading } = useLeadComments(leadId)
  const { create } = useLeadCommentMutations(leadId)
  const [draft, setDraft] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    await create.mutateAsync({ lead_id: leadId, content: draft })
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Input para novo comentário */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva um comentário sobre este lead..."
          rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none transition-all focus:outline-none"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
          onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
          onBlur={(e)  => (e.currentTarget.style.border = '1px solid #2a2a2a')}
        />
        <div className="flex justify-end">
          <button type="submit" disabled={!draft.trim() || create.isPending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
            style={{ background: 'var(--tenant-primary)', color: '#000' }}>
            <Send size={12} />
            {create.isPending ? 'Enviando...' : 'Comentar'}
          </button>
        </div>
      </form>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="h-10 w-10 rounded-full flex items-center justify-center"
            style={{ background: '#1a1a1a' }}>
            <MessageSquare size={18} style={{ color: '#444' }} />
          </div>
          <p className="text-xs" style={{ color: '#555' }}>Nenhum comentário ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} leadId={leadId} />
          ))}
        </div>
      )}
    </div>
  )
}

function CommentItem({ comment, leadId }: { comment: LeadComment; leadId: string }) {
  const { update, remove } = useLeadCommentMutations(leadId)
  const confirm       = useConfirm()
  const currentUser   = useAuthStore((s) => s.user)
  const currentRole   = useAuthStore((s) => s.membership?.role)
  const isSuperAdmin  = useAuthStore((s) => s.isSuperAdmin)

  const isAuthor = comment.user_id === currentUser?.id
  const canEdit   = isAuthor
  const canDelete = isAuthor || currentRole === 'admin' || currentRole === 'manager' || isSuperAdmin

  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(comment.content)

  async function handleSave() {
    if (!draft.trim() || draft.trim() === comment.content) {
      setEditing(false)
      return
    }
    await update.mutateAsync({ id: comment.id, content: draft })
    setEditing(false)
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Excluir comentário', message: 'Excluir este comentário?',
      confirmLabel: 'Excluir', danger: true,
    })
    if (ok) remove.mutate(comment.id)
  }

  const authorLabel = comment.user_name
    ?? (comment.user_email ? comment.user_email.split('@')[0] : 'Usuário')

  return (
    <div className="rounded-lg p-3"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: 'var(--tenant-primary)', color: '#000' }}>
            {authorLabel[0]?.toUpperCase()}
          </div>
          <span className="text-xs font-medium truncate" style={{ color: '#aaa' }}>{authorLabel}</span>
          <span className="text-[10px] shrink-0" style={{ color: '#444' }}>
            · {formatDistanceToNow(comment.created_at)}
            {comment.updated_at !== comment.created_at && ' (editado)'}
          </span>
        </div>
        {!editing && (
          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && (
              <button onClick={() => setEditing(true)} title="Editar"
                className="h-6 w-6 rounded flex items-center justify-center transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#40a0ff'; e.currentTarget.style.background = 'rgba(64,160,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
                <Pencil size={11} />
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={remove.isPending} title="Excluir"
                className="h-6 w-6 rounded flex items-center justify-center transition-colors disabled:opacity-40"
                style={{ color: '#555' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full rounded-md px-2 py-1.5 text-sm resize-none focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <button onClick={() => { setEditing(false); setDraft(comment.content) }}
              className="flex items-center gap-1 text-xs rounded px-2 py-1 transition-colors"
              style={{ color: '#666' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <X size={11} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={update.isPending}
              className="flex items-center gap-1 text-xs rounded px-2 py-1 font-medium disabled:opacity-40"
              style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>
              <Check size={11} /> Salvar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed" style={{ color: '#aaa' }}>
          {comment.content}
        </p>
      )}
    </div>
  )
}
