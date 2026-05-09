import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useLeadMutations } from '../../hooks/useLeadMutations'
import type { Lead } from '@/types'

interface DeleteConfirmModalProps {
  lead: Lead | null
  onClose: () => void
}

export function DeleteConfirmModal({ lead, onClose }: DeleteConfirmModalProps) {
  const { remove } = useLeadMutations()

  async function handleDelete() {
    if (!lead) return
    await remove.mutateAsync(lead.id)
    onClose()
  }

  return (
    <Modal
      open={!!lead}
      onClose={onClose}
      title="Excluir lead"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={remove.isPending}>
            Cancelar
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={handleDelete}>
            Excluir
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <div>
          <p className="text-sm text-slate-700">
            Você está prestes a excluir permanentemente o lead{' '}
            <strong className="text-slate-900">{lead?.name}</strong>.
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Todo o histórico de atividades também será removido.
          </p>
        </div>
      </div>
    </Modal>
  )
}
