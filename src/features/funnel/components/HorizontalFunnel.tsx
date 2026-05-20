import { useFunnelMetrics } from '../hooks/useFunnelSteps'
import { Spinner } from '@/components/ui/Spinner'

interface HorizontalFunnelProps {
  /** Altura do SVG em px. Default 220 */
  height?: number
}

export function HorizontalFunnel({ height = 220 }: HorizontalFunnelProps) {
  const { data: metrics = [], isLoading, error } = useFunnelMetrics()

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  }

  if (error) {
    return (
      <div className="rounded-xl p-4 flex flex-col gap-2"
        style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}>
        <p className="text-sm font-medium" style={{ color: '#ff4444' }}>
          Erro ao carregar funil
        </p>
        <p className="text-xs font-mono rounded px-2 py-1 break-all"
          style={{ background: 'rgba(0,0,0,0.2)', color: '#ff6666' }}>
          {(error as Error).message}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Execute o SQL <code>supabase/funnel_pipeline_only.sql</code> no Supabase pra atualizar a função do funil.
        </p>
      </div>
    )
  }

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl p-6 text-center text-sm"
        style={{ background: 'var(--bg-surface2)', border: '1px dashed var(--border-dim)', color: 'var(--text-dim)' }}>
        Nenhum passo do funil configurado. Crie passos na aba <strong>Configuração do Funil</strong>.
      </div>
    )
  }

  // Maior valor define a largura máxima (boca do funil = 100%)
  const maxCount = Math.max(...metrics.map((m) => m.countAtOrBeyond), 1)

  // Padding interno
  const PADDING_X = 16
  const STEP_GAP  = 4

  // Calcula largura proporcional pra cada passo
  const stepsPercent = metrics.map((m) => (m.countAtOrBeyond / maxCount) * 100)

  return (
    <div className="flex flex-col gap-3">
      {/* SVG do funil — trapezoides horizontais */}
      <div className="relative w-full" style={{ height }}>
        <svg
          viewBox={`0 0 1000 ${height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height }}
        >
          {metrics.map((m, i) => {
            const next     = metrics[i + 1]
            const myPct    = stepsPercent[i]
            const nextPct  = next ? stepsPercent[i + 1] : myPct * 0.4

            // Esse trapézio: largura à esquerda = myPct, à direita = nextPct
            const leftX  = PADDING_X
            const rightX = 1000 - PADDING_X
            const myWidth   = (myPct   / 100) * (rightX - leftX)
            const nextWidth = (nextPct / 100) * (rightX - leftX)
            const myCenter   = (rightX + leftX) / 2
            const nextCenter = (rightX + leftX) / 2

            // Por passo, dividimos o eixo X em segmentos iguais
            const segmentWidth = (rightX - leftX) / metrics.length - STEP_GAP
            const segLeft      = leftX + i * (segmentWidth + STEP_GAP)
            const segRight     = segLeft + segmentWidth

            // Vértices do trapézio (largura central baseada em myPct/nextPct)
            const yTop    = (height - height * (myPct   / 100)) / 2
            const yBot    = height - yTop
            const yTopR   = (height - height * (nextPct / 100)) / 2
            const yBotR   = height - yTopR

            // Não usamos myCenter/nextCenter nem myWidth/nextWidth pra evitar lint
            void myCenter; void nextCenter; void myWidth; void nextWidth

            const points = [
              `${segLeft},${yTop}`,
              `${segRight},${yTopR}`,
              `${segRight},${yBotR}`,
              `${segLeft},${yBot}`,
            ].join(' ')

            return (
              <g key={m.stepId}>
                <polygon
                  points={points}
                  fill={m.stepColor}
                  fillOpacity={0.85}
                  stroke={m.stepColor}
                  strokeWidth={1}
                />
                {/* Label dentro do segmento */}
                <text
                  x={(segLeft + segRight) / 2}
                  y={height / 2 - 4}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill="#ffffff"
                  style={{ pointerEvents: 'none' }}
                >
                  {m.countAtOrBeyond}
                </text>
                <text
                  x={(segLeft + segRight) / 2}
                  y={height / 2 + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#ffffff"
                  fillOpacity={0.9}
                  style={{ pointerEvents: 'none' }}
                >
                  {m.stepName.length > 18 ? m.stepName.slice(0, 16) + '…' : m.stepName}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Detalhes abaixo (com queda entre passos) */}
      <div className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
        {metrics.map((m, i) => {
          const prev = i > 0 ? metrics[i - 1] : null
          const dropoff = prev && prev.countAtOrBeyond > 0
            ? Math.round(((prev.countAtOrBeyond - m.countAtOrBeyond) / prev.countAtOrBeyond) * 100)
            : 0
          const retention = prev && prev.countAtOrBeyond > 0
            ? Math.round((m.countAtOrBeyond / prev.countAtOrBeyond) * 100)
            : 100

          return (
            <div key={m.stepId}
              className="rounded-lg p-3 text-center flex flex-col gap-1"
              style={{
                background: 'var(--bg-surface2)',
                border: `1px solid ${m.stepColor}33`,
              }}>
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: m.stepColor }} />
                <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                  {m.stepName}
                </span>
              </div>
              <p className="text-xl font-bold tabular-nums" style={{ color: m.stepColor }}>
                {m.countAtOrBeyond}
              </p>
              {prev && (
                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                  {retention}% do anterior
                  {dropoff > 0 && (
                    <span className="ml-1" style={{ color: dropoff >= 50 ? '#ff4444' : '#fbbf24' }}>
                      (-{dropoff}%)
                    </span>
                  )}
                </p>
              )}
              {m.countLostHere > 0 && (
                <p className="text-[10px]" style={{ color: '#ff4444' }}>
                  {m.countLostHere} perdido{m.countLostHere > 1 ? 's' : ''} aqui
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
