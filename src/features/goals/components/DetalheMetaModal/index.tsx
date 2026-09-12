import { Users, Zap, CheckCircle, Cpu, Hand } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDetalheMeta } from '../../hooks/useGoals'
import type { GoalWithProgress } from '@/services/goals'

/**
 * Do que é feito o número da meta.
 *
 * O Victor decidiu não bloquear contato manual nem exigir contrato pra venda:
 * "na hora de acompanhar vai ter auditoria". Esta tela É a auditoria. Cada
 * contato diz se veio do sistema (telefonia, CRC) ou foi registrado na mão —
 * dez contatos manuais e nenhuma venda ficam visíveis sem ninguém precisar
 * travar nada.
 */
export function DetalheMetaModal({ goal, onClose }: { goal: GoalWithProgress | null; onClose: () => void }) {
  const { data, isLoading, error } = useDetalheMeta(goal?.id ?? null)
  const nome = goal?.userFullName ?? goal?.userEmail ?? ''

  return (
    <Modal open={!!goal} onClose={onClose} size="lg"
      title="Do que é feito este número"
      description={goal ? `${nome} · ${formatDate(goal.start_date)} a ${formatDate(goal.end_date)}` : ''}>
      {isLoading || !data ? (
        <div className="flex justify-center py-10">
          {error ? <p className="text-sm" style={{ color: '#ff4444' }}>{(error as Error).message}</p> : <Spinner size="md" />}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Coluna icone={Users} cor="#40a0ff" titulo="Leads captados" total={data.leads.length}>
            {data.leads.map((l) => (
              <Linha key={l.id} principal={l.nome} secundario={formatDate(l.em)} />
            ))}
          </Coluna>

          <Coluna icone={Zap} cor="#fbbf24" titulo="Contatos" total={data.contatos.length}>
            {data.contatos.map((c) => (
              <Linha key={c.lead_id} principal={c.nome}
                secundario={`${c.vezes}× · ${formatDate(c.em)}`}
                etiqueta={c.origem === 'sistema'
                  ? { texto: 'sistema', cor: '#00e676', Icone: Cpu }
                  : { texto: 'manual',  cor: '#888',    Icone: Hand }} />
            ))}
          </Coluna>

          <Coluna icone={CheckCircle} cor="#00e676" titulo="Vendas" total={data.vendas.length}>
            {data.vendas.map((v) => (
              <Linha key={v.id} principal={v.nome}
                secundario={`${v.valor != null ? formatCurrency(Number(v.valor)) : 'sem valor'} · ${formatDate(v.em)}`} />
            ))}
          </Coluna>
        </div>
      )}
    </Modal>
  )
}

function Coluna({ icone: Icone, cor, titulo, total, children }: {
  icone: React.ElementType; cor: string; titulo: string; total: number; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-2 min-h-0"
      style={{ background: '#111', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
          <Icone size={13} style={{ color: cor }} /> {titulo}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: cor }}>{total}</span>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 320 }}>
        {total === 0
          ? <p className="text-xs py-3 text-center" style={{ color: '#444' }}>Nada neste período</p>
          : children}
      </div>
    </div>
  )
}

function Linha({ principal, secundario, etiqueta }: {
  principal: string; secundario: string
  etiqueta?: { texto: string; cor: string; Icone: React.ElementType }
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
      style={{ background: '#161616' }}>
      <div className="min-w-0">
        <p className="text-xs truncate" style={{ color: '#e8e8e8' }}>{principal}</p>
        <p className="text-[10px]" style={{ color: '#555' }}>{secundario}</p>
      </div>
      {etiqueta && (
        <span className="flex items-center gap-1 text-[10px] rounded-full px-1.5 py-0.5 shrink-0"
          style={{ background: `${etiqueta.cor}1a`, color: etiqueta.cor }}>
          <etiqueta.Icone size={9} /> {etiqueta.texto}
        </span>
      )}
    </div>
  )
}
