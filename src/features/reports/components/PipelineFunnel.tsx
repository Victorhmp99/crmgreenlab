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

export function PipelineFunnel({ data }: { data: PipelineFunnelData }) {
  const top = data.stages[0]?.reached || 1

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Entraram"     value={data.entered} color="#e8e8e8" />
        <Stat label="Em andamento" value={data.active}  color="#40a0ff" />
        <Stat label="Ganhos"       value={data.won}     sub={data.wonValue > 0 ? formatCurrencyCompact(data.wonValue) : undefined} color="#00e676" />
        <Stat label="Perdidos"     value={data.lost}    color="#ff4444" />
        <Stat label="Conversão"    value={`${data.convRate}%`} color="#a78bfa" />
      </div>

      {/* Funil — cada barra = etapa de andamento, largura ∝ leads que chegaram nela ou além */}
      {data.stages.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: '#555' }}>
          Esta pipeline não tem etapas de andamento configuradas.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.stages.map((s, i) => {
            const w = Math.max((s.reached / top) * 100, 4)
            return (
              <div key={s.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 rounded-lg flex items-center px-3 transition-all overflow-hidden"
                    style={{ width: `${w}%`, minWidth: 110, background: `${s.color}22`, border: `1px solid ${s.color}66` }}
                  >
                    <span className="text-xs font-medium truncate" style={{ color: '#e8e8e8' }}>{s.name}</span>
                  </div>
                  <div className="shrink-0 text-right" style={{ minWidth: 78 }}>
                    <span className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{s.reached}</span>
                    <span className="text-[10px] ml-1" style={{ color: '#666' }}>{s.pctOfTop}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-1 text-[10px]" style={{ color: '#555' }}>
                  {i > 0 && (
                    <span style={{ color: s.pctOfPrev < 40 ? '#ff6b6b' : '#666' }}>
                      {s.pctOfPrev}% avançaram da etapa anterior
                    </span>
                  )}
                  {s.atStage > 0 && (
                    <span>· {s.atStage} parado{s.atStage !== 1 ? 's' : ''} nesta etapa</span>
                  )}
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
        estão nela agora) — reconstruído pela jornada de cada lead: etapa atual + histórico de movimentação. Onde a barra
        encolhe muito é onde você está perdendo. <strong style={{ color: '#888' }}>Observação:</strong> o histórico de
        movimentação começou a ser gravado recentemente, então leads perdidos há mais tempo podem contar só na 1ª etapa;
        a precisão aumenta conforme os leads vão sendo movimentados.
      </p>
    </div>
  )
}
