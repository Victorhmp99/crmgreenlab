import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Confirmação de exclusão em MASSA — com a palavra digitada.
 *
 * Excluir um lead pedia a palavra; excluir cinquenta de uma vez era um clique.
 * Estava invertido: o botão perigoso era o desprotegido, e um clique errado na
 * barra de seleção apagava tudo o que estava marcado sem chance de recuar.
 *
 * Existia duas vezes, copiado, em Leads e em Movimentações. Agora é um só —
 * quem escrever a próxima tela de seleção herda a proteção em vez de esquecer
 * dela.
 */

const PALAVRA = 'deletar'

export function BulkDeleteConfirm({ count, label, labelPlural, onCancel, onConfirm, loading, erro }: {
  count:        number
  /** Singular, minúsculo: "lead", "movimentação" */
  label:        string
  /** Plural, quando não for só somar "s": "movimentações" */
  labelPlural?: string
  onCancel:     () => void
  onConfirm:    () => void
  loading:      boolean
  /** Motivo da recusa, quando o banco barra a exclusão (cota, prazo, cargo). */
  erro?:        string | null
}) {
  const [digitado, setDigitado] = useState('')
  const podeExcluir = digitado.trim().toLowerCase() === PALAVRA && !loading

  const nome = count === 1 ? label : (labelPlural ?? `${label}s`)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={loading ? undefined : onCancel}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#141414', border: '1px solid #2a2a2a' }}>

        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)' }}>
            <AlertTriangle size={18} style={{ color: '#ff4444' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: '#ff4444' }}>
              Excluir {count} {nome}?
            </h3>
            <p className="text-sm mt-1" style={{ color: '#888' }}>
              Todo o histórico vinculado também será removido. Esta ação{' '}
              <strong>não pode ser desfeita</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: '#aaa' }}>
            Para confirmar, digite <strong style={{ color: '#ff4444' }}>{PALAVRA}</strong> abaixo:
          </label>
          <input
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            autoFocus
            placeholder={PALAVRA}
            className="h-10 rounded-lg px-3 text-sm focus:outline-none transition-all"
            style={{
              background: '#1a1a1a',
              border: `1px solid ${podeExcluir ? '#ff4444' : '#2a2a2a'}`,
              color: '#e8e8e8',
            }}
          />
        </div>

        {erro && (
          <div className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)', color: '#ff4444' }}>
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-40"
            style={{ color: '#aaa', border: '1px solid #2a2a2a' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={!podeExcluir}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,68,68,0.15)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.4)' }}
            onMouseEnter={(e) => { if (podeExcluir) e.currentTarget.style.background = 'rgba(255,68,68,0.25)' }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.15)')}>
            {loading ? 'Excluindo...' : `Excluir ${count}`}
          </button>
        </div>
      </div>
    </div>
  )
}
