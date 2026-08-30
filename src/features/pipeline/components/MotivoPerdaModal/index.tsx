import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MOTIVOS_PERDA } from '@/services/regrasPipeline'

/**
 * Pergunta por que o lead foi perdido, antes de o card entrar na coluna.
 *
 * É o único momento em que a resposta é barata: quem acabou de arrastar sabe o
 * motivo de cabeça. Perguntar depois, num relatório, ninguém lembra — e é por
 * isso que esse dado nunca existiu.
 */
export function MotivoPerdaModal({ open, nomeLead, onCancelar, onConfirmar }: {
  open:        boolean
  nomeLead:    string
  onCancelar:  () => void
  onConfirmar: (motivo: string) => void
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null)

  function confirmar() {
    if (!escolhido) return
    onConfirmar(escolhido)
    setEscolhido(null)
  }

  return (
    <Modal open={open} onClose={onCancelar} size="sm"
      title="Por que perdeu?"
      description={nomeLead}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => { setEscolhido(null); onCancelar() }}
            className="text-sm px-3 h-9" style={{ color: '#888' }}>
            Cancelar
          </button>
          <Button onClick={confirmar} disabled={!escolhido}>Marcar como perdido</Button>
        </div>
      }>

      <div className="flex flex-col gap-1.5">
        {MOTIVOS_PERDA.map((m) => {
          const ativo = escolhido === m.valor
          return (
            <button
              key={m.valor}
              type="button"
              onClick={() => setEscolhido(m.valor)}
              className="w-full text-left text-sm rounded-lg px-3 py-2 transition-colors"
              style={{
                background: ativo ? 'rgba(0,230,118,0.1)' : '#1a1a1a',
                border:     `1px solid ${ativo ? '#2f6f4f' : '#242424'}`,
                color:      ativo ? '#00e676' : '#bbb',
              }}
            >
              {m.rotulo}
            </button>
          )
        })}
      </div>

      <p className="text-[11px] mt-3" style={{ color: '#555' }}>
        Se o lead voltar pro funil depois, o motivo é apagado sozinho — motivo
        velho num lead ativo estragaria o relatório de perdas.
      </p>
    </Modal>
  )
}
