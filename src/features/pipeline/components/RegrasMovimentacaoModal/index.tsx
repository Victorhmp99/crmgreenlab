import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Check, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import {
  fetchRegrasPipeline, salvarRegrasPipeline, type RegrasPipeline,
} from '@/services/regrasPipeline'

/**
 * Restrições de troca de etapa, por funil.
 *
 * Nascem desligadas: ligar pra todo mundo de uma vez travaria quem usa o
 * quadro de outro jeito. Quem decide o rigor é o gestor de cada funil.
 */
export function RegrasMovimentacaoModal({ open, onClose, pipelineId, pipelineName }: {
  open:         boolean
  onClose:      () => void
  pipelineId:   string
  pipelineName: string
}) {
  const queryClient = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const { data: regras, isLoading } = useQuery({
    queryKey: ['regras-pipeline', pipelineId],
    queryFn:  () => fetchRegrasPipeline(pipelineId),
    enabled:  open && !!pipelineId,
  })

  const salvar = useMutation({
    mutationFn: (novas: RegrasPipeline) => salvarRegrasPipeline(pipelineId, novas),
    onSuccess: () => {
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['regras-pipeline', pipelineId] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  function alternar(chave: keyof RegrasPipeline) {
    if (!regras) return
    salvar.mutate({ ...regras, [chave]: !regras[chave] })
  }

  return (
    <Modal open={open} onClose={onClose} size="md"
      title="Regras de movimentação"
      description={pipelineName}>

      {isLoading || !regras ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {erro && (
            <p className="text-sm rounded-lg px-3 py-2"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{erro}</p>
          )}

          <Regra
            ligada={regras.exigirContratoParaGanhar}
            onToggle={() => alternar('exigirContratoParaGanhar')}
            titulo="Exigir contrato pra marcar venda"
            texto="Sem contrato cadastrado, o card não entra na coluna de venda. Protege o faturamento e o evento de compra que vai pro Meta — hoje qualquer arrastada vira venda aos olhos da campanha."
          />

          <Regra
            ligada={regras.exigirMotivoPerda}
            onToggle={() => alternar('exigirMotivoPerda')}
            titulo="Exigir motivo ao perder"
            texto="Ao mover pra uma coluna de perda, o vendedor escolhe o porquê numa lista curta. É a única hora em que ele lembra — e é o dado que responde por que vocês perdem."
          />

          <p className="flex items-start gap-2 text-[11px] mt-1" style={{ color: '#666' }}>
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>
              As regras valem no servidor, não só nesta tela — não dá pra contornar arrastando
              de outro jeito. Elas se aplicam às colunas marcadas como <strong>venda</strong> e{' '}
              <strong>perda</strong> nas Etapas do Funil; se nenhuma estiver marcada assim, nada
              é bloqueado.
            </span>
          </p>
        </div>
      )}
    </Modal>
  )
}

function Regra({ ligada, onToggle, titulo, texto }: {
  ligada:   boolean
  onToggle: () => void
  titulo:   string
  texto:    string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-start gap-3 rounded-xl p-3 text-left transition-colors"
      style={{
        background: ligada ? 'rgba(0,230,118,0.06)' : '#171717',
        border:     `1px solid ${ligada ? 'rgba(0,230,118,0.25)' : '#222'}`,
      }}
    >
      <span className="h-5 w-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: ligada ? '#00e676' : '#1f1f1f',
          border:     `1px solid ${ligada ? '#00e676' : '#2c2c2c'}`,
        }}>
        {ligada && <Check size={13} style={{ color: '#0d0d0d' }} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 text-sm" style={{ color: ligada ? '#e8e8e8' : '#bbb' }}>
          <ArrowLeftRight size={13} style={{ color: ligada ? '#00e676' : '#555' }} />
          {titulo}
        </span>
        <span className="block text-[11px] leading-relaxed mt-1" style={{ color: '#666' }}>
          {texto}
        </span>
      </span>
    </button>
  )
}
