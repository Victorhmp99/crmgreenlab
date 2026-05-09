import { useState } from 'react'
import { Plus, Target, Trophy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { GoalCard } from '../components/GoalCard'
import { GoalForm } from '../components/GoalForm'
import { Leaderboard } from '../components/Leaderboard'
import { useAllGoals, useMyGoals } from '../hooks/useGoals'
import { useGoalMutations } from '../hooks/useGoalMutations'
import { usePermissions } from '@/hooks/usePermissions'
import type { GoalWithProgress } from '@/services/goals'

type Tab = 'mine' | 'team' | 'leaderboard'

// Primeiro e último dia do mês corrente
function currentMonthRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

export function GoalsPage() {
  const { isManager } = usePermissions()
  const [tab, setTab]             = useState<Tab>('mine')
  const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null | undefined>(undefined)

  const { data: myGoals  = [], isLoading: myLoading,  refetch: refetchMine } = useMyGoals()
  const { data: allGoals = [], isLoading: allLoading, refetch: refetchAll  } = useAllGoals()
  const { remove } = useGoalMutations()

  const { start, end } = currentMonthRange()

  function handleDelete(goal: GoalWithProgress) {
    if (confirm(`Excluir meta de "${goal.userEmail ?? goal.user_id}"?`)) {
      remove.mutate(goal.id)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'mine',        label: 'Minhas Metas', icon: Target },
    ...(isManager ? [
      { id: 'team'        as Tab, label: 'Equipe',  icon: Target },
      { id: 'leaderboard' as Tab, label: 'Ranking', icon: Trophy },
    ] : []),
  ]

  const activeGoals = tab === 'mine'
    ? myGoals.filter((g) => new Date().toISOString().slice(0, 10) <= g.end_date)
    : allGoals
  const isLoading = tab === 'mine' ? myLoading : allLoading

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Metas</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            Acompanhe o progresso individual e da equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchMine(); refetchAll() }}
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ border: '1px solid #2a2a2a', color: '#555' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#555'
            }}
            title="Atualizar"
          >
            <RefreshCw size={15} />
          </button>
          {isManager && (
            <Button onClick={() => setEditingGoal(null)}>
              <Plus size={15} />
              Nova Meta
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl p-1 gap-1 self-start"
        style={{ background: '#111', border: '1px solid #1e1e1e' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={
              tab === id
                ? { background: '#1e1e1e', color: '#e8e8e8', boxShadow: '0 0 0 1px #2a2a2a' }
                : { color: '#555' }
            }
            onMouseEnter={(e) => {
              if (tab !== id) (e.currentTarget as HTMLButtonElement).style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              if (tab !== id) (e.currentTarget as HTMLButtonElement).style.color = '#555'
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo por aba */}
      {tab === 'leaderboard' ? (
        <div>
          <p className="text-sm mb-4" style={{ color: '#555' }}>Ranking do mês corrente</p>
          <Leaderboard startDate={start} endDate={end} />
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : activeGoals.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: '#1a1a1a' }}>
            <Target size={28} style={{ color: '#333' }} />
          </div>
          <div>
            <p className="font-medium" style={{ color: '#666' }}>Nenhuma meta encontrada</p>
            <p className="text-sm mt-0.5" style={{ color: '#444' }}>
              {tab === 'mine'
                ? 'Peça ao seu gestor para criar metas para você'
                : 'Clique em "Nova Meta" para começar'}
            </p>
          </div>
          {isManager && (
            <Button size="sm" onClick={() => setEditingGoal(null)}>
              <Plus size={14} />
              Criar primeira meta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={setEditingGoal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <GoalForm
        open={editingGoal !== undefined}
        onClose={() => setEditingGoal(undefined)}
        goal={editingGoal ?? null}
      />
    </div>
  )
}
