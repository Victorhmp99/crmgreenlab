import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'
import {
  periodoDoMes, periodoLivre, ultimosMeses, anoAtual, type Periodo,
} from '../../periodo'

/**
 * Período em foco do Financeiro.
 *
 * Começa no mês (que é como quase todo mundo olha caixa), mas aceita
 * intervalo livre — trimestre, semestre, ano ou um recorte qualquer. Sem
 * isso não dava pra responder "quanto faturei no semestre" sem somar seis
 * telas na mão.
 */

export function PeriodPicker({ periodo, onChange }: {
  periodo:  Periodo
  onChange: (p: Periodo) => void
}) {
  const hoje = new Date()
  const ref = new Date(periodo.from + 'T00:00:00')

  const chaveAtual = hoje.getFullYear() * 12 + hoje.getMonth()
  const chaveRef   = ref.getFullYear() * 12 + ref.getMonth()
  const ehMesAtual = periodo.modo === 'mes' && chaveRef === chaveAtual
  const ehFuturo   = periodo.modo === 'mes' && chaveRef > chaveAtual

  function navegarMes(delta: number) {
    onChange(periodoDoMes(new Date(ref.getFullYear(), ref.getMonth() + delta, 1)))
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl px-4 py-3"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarIcon size={15} style={{ color: 'var(--tenant-primary)' }} />
          <span className="text-sm" style={{ color: '#666' }}>Mostrando:</span>
          <span className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>{periodo.label}</span>
          {periodo.modo === 'mes' && (
            ehMesAtual ? (
              <span className="text-[10px] rounded-full px-2 py-0.5"
                style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>mês atual</span>
            ) : (
              <span className="text-[10px] rounded-full px-2 py-0.5"
                style={{ background: '#1e1e1e', color: '#888' }}>
                {ehFuturo ? 'mês futuro' : 'mês passado'}
              </span>
            )
          )}
          {periodo.modo === 'livre' && (
            <span className="text-[10px] rounded-full px-2 py-0.5"
              style={{ background: 'rgba(64,160,255,0.12)', color: '#40a0ff' }}>
              intervalo livre
            </span>
          )}
        </div>

        {periodo.modo === 'mes' && (
          <div className="flex items-center gap-1">
            <SetaBtn onClick={() => navegarMes(-1)} title="Mês anterior"><ChevronLeft size={15} /></SetaBtn>
            {!ehMesAtual && (
              <button onClick={() => onChange(periodoDoMes(new Date()))}
                className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                style={{ border: '1px solid #2a2a2a', color: '#aaa' }}
                title="Voltar para o mês atual">
                <Undo2 size={12} /> Voltar pra hoje
              </button>
            )}
            <SetaBtn onClick={() => navegarMes(1)} title="Próximo mês"><ChevronRight size={15} /></SetaBtn>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 flex-wrap pt-1" style={{ borderTop: '1px solid #1a1a1a' }}>
        <div className="flex gap-1.5 flex-wrap pt-2">
          <Atalho ativo={periodo.modo === 'mes'} onClick={() => onChange(periodoDoMes(new Date()))}>
            Este mês
          </Atalho>
          <Atalho ativo={periodo.label === 'Últimos 3 meses'} onClick={() => onChange(ultimosMeses(3))}>
            3 meses
          </Atalho>
          <Atalho ativo={periodo.label === 'Últimos 6 meses'} onClick={() => onChange(ultimosMeses(6))}>
            6 meses
          </Atalho>
          <Atalho ativo={periodo.label.startsWith('Ano de')} onClick={() => onChange(anoAtual())}>
            Este ano
          </Atalho>
        </div>

        <div className="flex items-end gap-2 ml-auto pt-2">
          <DatePicker label="De" className="w-36" clearable={false} value={periodo.from}
            onChange={(v) => v && onChange(periodoLivre(v, periodo.to < v ? v : periodo.to))} />
          <DatePicker label="Até" className="w-36" clearable={false} value={periodo.to}
            minDate={periodo.from}
            onChange={(v) => v && onChange(periodoLivre(periodo.from, v))} />
        </div>
      </div>
    </div>
  )
}

function Atalho({ ativo, onClick, children }: {
  ativo: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className="text-xs rounded-lg px-2.5 py-1.5 transition-colors"
      style={{
        background: ativo ? 'rgba(0,230,118,0.1)' : 'transparent',
        border: `1px solid ${ativo ? 'var(--tenant-primary)' : '#2a2a2a'}`,
        color: ativo ? 'var(--tenant-primary)' : '#888',
      }}>
      {children}
    </button>
  )
}

function SetaBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title}
      className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
      style={{ color: '#888' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      {children}
    </button>
  )
}
