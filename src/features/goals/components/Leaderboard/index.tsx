import { Trophy, Zap, Users, CheckCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useLeaderboard } from '../../hooks/useGoals'

interface LeaderboardProps {
  startDate: string
  endDate:   string
}

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ startDate, endDate }: LeaderboardProps) {
  const { data: entries = [], isLoading } = useLeaderboard(startDate, endDate)

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Trophy size={32} style={{ color: '#333' }} />
        <p className="text-sm" style={{ color: '#444' }}>Nenhum dado de equipe para este período</p>
      </div>
    )
  }

  const max = entries[0]?.totalScore || 1

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, index) => {
        const barWidth = Math.max(Math.round((entry.totalScore / max) * 100), 4)
        const name     = entry.fullName ?? entry.email

        return (
          <div key={entry.userId}
            className="rounded-xl p-4"
            style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl w-8 text-center shrink-0">
                {MEDALS[index] ?? `#${index + 1}`}
              </span>

              <div className="h-9 w-9 rounded-full flex items-center justify-center text-black text-sm font-semibold shrink-0"
                style={{ background: 'var(--tenant-primary)' }}>
                {name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: '#e8e8e8' }}>{name}</p>
                <p className="text-xs truncate" style={{ color: '#555' }}>{entry.email}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--tenant-primary)' }}>
                  {entry.totalScore}
                </p>
                <p className="text-[10px]" style={{ color: '#444' }}>pontos</p>
              </div>
            </div>

            {/* Barra de score */}
            <div className="h-1.5 w-full rounded-full mb-3" style={{ background: '#1e1e1e' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${barWidth}%`,
                  background: 'linear-gradient(to right, var(--tenant-primary), #00c853)',
                }}
              />
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <StatMini icon={Users}       label="Leads"    value={entry.leads} />
              <StatMini icon={Zap}         label="Disparos" value={entry.calls} />
              <StatMini icon={CheckCircle} label="Fechados" value={entry.deals} color="#00e676" />
            </div>
          </div>
        )
      })}

      <p className="text-xs text-center mt-1" style={{ color: '#444' }}>
        Pontuação: 1pt por lead ou disparo · 3pts por fechamento
      </p>
    </div>
  )
}

function StatMini({
  icon: Icon, label, value, color = '#888',
}: { icon: React.ElementType; label: string; value: number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon size={13} style={{ color: '#444' }} />
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px]" style={{ color: '#444' }}>{label}</span>
    </div>
  )
}
