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
      <div className="flex flex-col items-center gap-3 py-12 text-center text-slate-400">
        <Trophy size={32} className="text-slate-300" />
        <p className="text-sm">Nenhum dado de equipe para este período</p>
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
          <div key={entry.userId} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3 mb-3">
              {/* Posição */}
              <span className="text-xl w-8 text-center shrink-0">
                {MEDALS[index] ?? `#${index + 1}`}
              </span>

              {/* Avatar + nome */}
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{name}</p>
                <p className="text-xs text-slate-400 truncate">{entry.email}</p>
              </div>

              {/* Score total */}
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-slate-900 tabular-nums">{entry.totalScore}</p>
                <p className="text-[10px] text-slate-400">pontos</p>
              </div>
            </div>

            {/* Barra de score relativo */}
            <div className="h-1.5 w-full rounded-full bg-slate-100 mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Métricas individuais */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <StatMini icon={Users}       label="Leads"     value={entry.leads} />
              <StatMini icon={Zap}         label="Disparos"  value={entry.calls} />
              <StatMini icon={CheckCircle} label="Fechados"  value={entry.deals} color="text-emerald-600" />
            </div>
          </div>
        )
      })}

      <p className="text-xs text-center text-slate-400 mt-1">
        Pontuação: 1pt por lead ou disparo · 3pts por fechamento
      </p>
    </div>
  )
}

function StatMini({
  icon: Icon,
  label,
  value,
  color = 'text-slate-700',
}: {
  icon: React.ElementType
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon size={13} className="text-slate-400" />
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  )
}
