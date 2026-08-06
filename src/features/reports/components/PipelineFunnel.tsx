import { formatCurrencyCompact } from '@/lib/utils'
import type { PipelineFunnelData } from '@/services/reports'

function Stat({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color: string
}) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: '#555' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] tabular-nums" style={{ color: '#666' }}>{sub}</p>}
    </div>
  )
}

interface Bar {
  name:      string
  color:     string
  reached:   number
  pctOfTop:  number
  pctOfPrev: number
}

export function PipelineFunnel({ data }: { data: PipelineFunnelData }) {
  const top = data.stages[0]?.reached || 1

  // Monta as barras do funil: as etapas de fluxo + a etapa final "Convertido"
  // (os ganhos), pra o funil terminar na conversão — igual "15 leads / 15% converteu".
  const flowBars: Bar[] = data.stages.map((s) => ({
    name: s.name, color: s.color, reached: s.reached, pctOfTop: s.pctOfTop, pctOfPrev: s.pctOfPrev,
  }))
  const lastReached = data.stages.length ? data.stages[data.stages.length - 1].reached : 0
  const convertedBar: Bar = {
    name: 'Convertido',
    color: '#00e676',
    reached: data.won,
    pctOfTop:  Math.round((data.won / top) * 100),
    pctOfPrev: lastReached > 0 ? Math.round((data.won / lastReached) * 100) : 0,
  }
  const bars: Bar[] = data.stages.length > 0 ? [...flowBars, convertedBar] : []

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Entraram"     value={data.entered} color="#e8e8e8" />
        <Stat label="Em andamento" value={data.active}  color="#40a0ff" />
        <Stat label="Convertidos"  value={data.won}     sub={data.wonValue > 0 ? formatCurrencyCompact(data.wonValue) : undefined} color="#00e676" />
        <Stat label="Perdidos"     value={data.lost}    color="#ff4444" />
        <Stat label="Conversão"    value={`${data.convRate}%`} color="#a78bfa" />
      </div>

      {/* Funil visual — barras centralizadas que afunilam de cima pra baixo */}
      {bars.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: '#555' }}>
          Esta pipeline não tem etapas de andamento configuradas.
        </p>
      ) : (
        <div className="flex flex-col gap-1 py-1">
          {bars.map((b, i) => {
            const w = Math.max(b.pctOfTop, 7)   // largura mínima pra caber o número
            return (
              <div key={`${b.name}-${i}`} className="flex flex-col items-center gap-1">
                {/* Conector: % que avançou da etapa anterior */}
                {i > 0 && (
                  <span className="text-[10px] tabular-nums"
                    style={{ color: b.pctOfPrev < 40 ? '#ff6b6b' : '#666' }}>
                    ↓ {b.pctOfPrev}% avançaram
                  </span>
                )}
                {/* Linha: nome · barra centralizada · % do total */}
                <div className="w-full flex items-center gap-2">
                  <span className="text-xs text-right shrink-0 truncate" style={{ width: 104, color: '#aaa' }}>
                    {b.name}
                  </span>
                  <div className="flex-1 flex justify-center">
                    <div
                      className="h-9 rounded-md flex items-center justify-center transition-all"
                      style={{
                        width: `${w}%`, minWidth: 44,
                        background: `${b.color}2e`,
                        border: `1px solid ${b.color}`,
                      }}
                    >
                      <span className="text-sm font-bold tabular-nums" style={{ color: b.color }}>
                        {b.reached}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-left shrink-0 tabular-nums" style={{ width: 52, color: '#777' }}>
                    {b.pctOfTop}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data.archived > 0 && (
        <p className="text-[11px]" style={{ color: '#666' }}>
          + {data.archived} arquivado{data.archived !== 1 ? 's' : ''} (fora do funil ativo).
        </p>
      )}
      <p className="text-[11px] leading-relaxed" style={{ color: '#555' }}>
        Cada barra = quantos leads <strong style={{ color: '#888' }}>já passaram</strong> por aquela etapa (não só os que
        estão nela agora), reconstruído pela jornada de cada lead: etapa atual + histórico de movimentação. O
        <strong style={{ color: '#888' }}> % do total</strong> (à direita) e o <strong style={{ color: '#888' }}>% que
        avançaram</strong> (entre as barras) mostram onde você mais perde. <strong style={{ color: '#888' }}>Observação:</strong> o
        histórico começou a ser gravado há pouco, então leads perdidos há mais tempo podem contar só na 1ª etapa; a
        precisão aumenta conforme os leads vão sendo movimentados.
      </p>
    </div>
  )
}
