import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useLeadMutations } from '../../hooks/useLeadMutations'
import type { Lead } from '@/types'

interface DeleteConfirmModalProps {
  lead:    Lead | null
  onClose: () => void
}

const CONFIRM_WORD = 'deletar'

export function DeleteConfirmModal({ lead, onClose }: DeleteConfirmModalProps) {
  const { remove } = useLeadMutations()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Limpa o input toda vez que abre/troca de lead
  useEffect(() => { setTyped(''); setError(null) }, [lead?.id])

  const canDelete = typed.trim().toLowerCase() === CONFIRM_WORD

  async function handleDelete() {
    if (!lead || !canDelete) return
    setError(null)
    try {
      await remove.mutateAsync(lead.id)
      onClose()
    } catch (err) {
      console.error('[DeleteConfirmModal] erro:', err)
      setError((err as Error).message ?? 'Erro ao excluir lead.')
    }
  }

  return (
    <Modal
      open={!!lead}
      onClose={onClose}
      title="Excluir lead permanentemente"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={remove.isPending}>Cancelar</Button>
          <Button variant="danger" loading={remove.isPending} disabled={!canDelete} onClick={handleDelete}>
            Excluir lead
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)' }}>
            <AlertTriangle size={18} style={{ color: '#ff4444' }} />
          </div>
          <div>
            <p className="text-sm" style={{ color: '#e8e8e8' }}>
              Você está prestes a excluir permanentemente o lead{' '}
              <strong style={{ color: '#ff4444' }}>{lead?.name}</strong>.
            </p>
            <p className="text-xs mt-1" style={{ color: '#888' }}>
              Todo o histórico de atividades, comentários, tags e tarefas vinculados também serão removidos. Esta ação <strong>não pode ser desfeita</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: '#aaa' }}>
            Para confirmar, digite <strong style={{ color: '#ff4444' }}>{CONFIRM_WORD}</strong> abaixo:
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            placeholder={CONFIRM_WORD}
            className="h-10 rounded-lg px-3 text-sm focus:outline-none transition-all"
            style={{
              background: '#1a1a1a',
              border: `1px solid ${canDelete ? '#ff4444' : '#2a2a2a'}`,
              color: '#e8e8e8',
            }}
          />
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)', color: '#ff4444' }}>
            <strong>Erro:</strong> {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
