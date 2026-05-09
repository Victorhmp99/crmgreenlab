import { useState } from 'react'
import { Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ActivityItem } from '../components/ActivityItem'
import { ActivityFiltersBar } from '../components/ActivityFilters'
import { ActivityForm } from '../components/ActivityForm'
import { useActivities, useActivityStats } from '../hooks/useActivities'
import type { ActivityFilters } from '@/services/activities'

export function ActivitiesPage() {
  const [filters, setFilters]       = useState<ActivityFilters>({ page: 1, pageSize: 25 })
  const [showForm, setShowForm]     = useState(false)

  const { data, isLoading }         = useActivities(filters)
  const { data: stats }             = useActivityStats()

  function handlePageChange(page: number) {
    setFilters((f) => ({ ...f, page }))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Disparos</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {stats ? (
              <>
                <StatPill label="hoje"       value={stats.today}     color="text-blue-600"   />
                <StatPill label="esta semana" value={stats.thisWeek}  color="text-violet-600" />
                <StatPill label="este mês"   value={stats.thisMonth} color="text-slate-600"  />
              </>
            ) : (
              <div className="h-4 w-48 rounded bg-slate-100 animate-pulse" />
            )}
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="shrink-0">
          <Zap size={15} />
          Registrar Disparo
        </Button>
      </div>

      {/* Filtros */}
      <ActivityFiltersBar filters={filters} onChange={setFilters} />

      {/* Lista */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Zap size={26} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Nenhum disparo encontrado</p>
            <p className="text-slate-400 text-sm">Ajuste os filtros ou registre o primeiro contato</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50 px-5 py-4">
              {data.data.map((activity, index) => (
                <div key={activity.id} className={index > 0 ? 'pt-4' : ''}>
                  <ActivityItem
                    activity={activity}
                    showLead
                    isLast={index === data.data.length - 1}
                  />
                </div>
              ))}
            </div>

            {/* Paginação */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  {data.count} disparo{data.count !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(data.page - 1)}
                    disabled={data.page <= 1}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-slate-700 px-2">
                    {data.page} / {data.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(data.page + 1)}
                    disabled={data.page >= data.totalPages}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ActivityForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="text-sm text-slate-500">
      <span className={`font-bold ${color}`}>{value}</span> {label}
    </span>
  )
}
