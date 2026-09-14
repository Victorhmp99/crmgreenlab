import { useQuery } from '@tanstack/react-query'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { formatDate } from '@/lib/utils'
import { fetchArchivedCards, updateCard, deleteCard, type BoardFull } from '@/services/boards'
import { useRecarregaQuadro } from '../hooks/useBoards'

/**
 * Cartões arquivados do quadro. Arquivar tira do quadro sem apagar — aqui é
 * onde eles ficam: volta pra coluna de origem ou apaga de vez.
 */
export function ArquivadosModal({ open, data, onClose }: { open: boolean; data: BoardFull; onClose: () => void }) {
  const confirm    = useConfirm()
  const recarregar = useRecarregaQuadro(data.board.id)
  const { data: cards = [], isLoading, refetch } = useQuery({
    queryKey: ['arquivados', data.board.id],
    queryFn:  () => fetchArchivedCards(data.board.id),
    enabled:  open,
  })

  async function restaurar(id: string, columnId: string) {
    // Se a coluna de origem foi apagada, volta pra primeira.
    const coluna = data.columns.some((c) => c.id === columnId) ? columnId : data.columns[0]?.id
    await updateCard(id, { archived_at: null, column_id: coluna, position: 1e9 })
    refetch(); recarregar()
  }

  async function excluir(id: string, title: string) {
    const ok = await confirm({ title: 'Excluir de vez', message: `Excluir "${title}" permanentemente?`, confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    await deleteCard(id)
    refetch(); recarregar()
  }

  return (
    <Modal open={open} onClose={onClose} title="Cartões arquivados" description={data.board.name} size="md">
      {isLoading ? <div className="flex justify-center py-8"><Spinner size="md" /></div>
      : cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Archive size={28} style={{ color: '#333' }} />
          <p className="text-sm" style={{ color: '#666' }}>Nada arquivado neste quadro.</p>
          <p className="text-xs max-w-xs" style={{ color: '#444' }}>Abra um cartão e use "Arquivar" pra tirá-lo do quadro sem apagar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {cards.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: '#161616', border: '1px solid #242424' }}>
              {c.color && <span className="h-6 w-1 rounded-full shrink-0" style={{ background: c.color }} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: c.completed_at ? '#7fbf9a' : '#e8e8e8', textDecoration: c.completed_at ? 'line-through' : 'none' }}>{c.title}</p>
                <p className="text-[11px]" style={{ color: '#555' }}>
                  arquivado em {formatDate(c.archived_at)}
                  {' · '}{data.columns.find((k) => k.id === c.column_id)?.name ?? 'coluna apagada'}
                </p>
              </div>
              <button onClick={() => restaurar(c.id, c.column_id)} className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-1.5 hover:bg-[#1e1e1e]" style={{ color: '#ccc' }} title="Voltar pro quadro">
                <RotateCcw size={12} /> Restaurar
              </button>
              <button onClick={() => excluir(c.id, c.title)} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[#2a0a0a]" style={{ color: '#ff4444' }} title="Excluir de vez">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
