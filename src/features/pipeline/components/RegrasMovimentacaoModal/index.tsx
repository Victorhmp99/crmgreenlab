import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Check, AlertTriangle, ArrowUpNarrowWide, PhoneCall } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
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

  // Etapas do funil pro seletor de "contato feito". A etapa é ESCOLHIDA, não
  // adivinhada pelo nome: cada empresa chama a coluna de um jeito, e errar o
  // palpite moveria o card pro lugar errado.
  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas-do-funil', pipelineId],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, position')
        .eq('pipeline_id', pipelineId)
        .order('position')
      if (error) throw error
      return (data ?? []) as Array<{ id: string; name: string; position: number }>
    },
    enabled: open && !!pipelineId,
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

          <Regra
            ligada={regras.ordenarPorEdicao}
            onToggle={() => alternar('ordenarPorEdicao')}
            Icone={ArrowUpNarrowWide}
            titulo="Lead que teve movimento sobe"
            texto="Registrou ligação ou editou o lead, o card vai pro topo da coluna. Arrastar continua mandando: se soltar no meio, fica no meio. Desligado, a ordem só muda quando alguém arrasta."
          />

          {/* O interruptor desta regra É a escolha da etapa: um booleano
              separado poderia ficar ligado apontando pra lugar nenhum. */}
          <div className="rounded-xl p-3"
            style={{
              background: regras.etapaContatoId ? 'rgba(0,230,118,0.06)' : '#171717',
              border: `1px solid ${regras.etapaContatoId ? 'rgba(0,230,118,0.25)' : '#222'}`,
            }}>
            <span className="flex items-center gap-1.5 text-sm"
              style={{ color: regras.etapaContatoId ? '#e8e8e8' : '#bbb' }}>
              <PhoneCall size={13} style={{ color: regras.etapaContatoId ? '#00e676' : '#555' }} />
              Mover pra uma etapa ao registrar contato
            </span>
            <span className="block text-[11px] leading-relaxed mt-1 mb-2" style={{ color: '#666' }}>
              Ao registrar uma ligação, o card anda sozinho pra esta etapa. Só vai PRA FRENTE —
              ligar pra quem já fechou não puxa o card de volta.
            </span>
            <select
              value={regras.etapaContatoId ?? ''}
              onChange={(e) => salvar.mutate({ ...regras, etapaContatoId: e.target.value || null })}
              className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
              style={{ background: '#1a1a1a', border: '1px solid #262626', color: '#e8e8e8' }}
            >
              <option value="">não mover nada</option>
              {etapas.map((et) => (
                <option key={et.id} value={et.id}>{et.name}</option>
              ))}
            </select>
          </div>

          <p className="flex items-start gap-2 text-[11px] mt-1" style={{ color: '#666' }}>
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>
              Tudo aqui vale no servidor, não só nesta tela — não dá pra contornar arrastando
              de outro jeito. As duas primeiras dependem de haver colunas marcadas como{' '}
              <strong>venda</strong> e <strong>perda</strong> nas Etapas do Funil; sem isso, nada
              é bloqueado. Todas nascem desligadas.
            </span>
          </p>
        </div>
      )}
    </Modal>
  )
}

function Regra({ ligada, onToggle, titulo, texto, Icone = ArrowLeftRight }: {
  ligada:   boolean
  onToggle: () => void
  titulo:   string
  texto:    string
  Icone?:   typeof ArrowLeftRight
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
          <Icone size={13} style={{ color: ligada ? '#00e676' : '#555' }} />
          {titulo}
        </span>
        <span className="block text-[11px] leading-relaxed mt-1" style={{ color: '#666' }}>
          {texto}
        </span>
      </span>
    </button>
  )
}
