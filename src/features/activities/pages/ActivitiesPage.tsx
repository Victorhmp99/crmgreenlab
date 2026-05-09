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
  const [filters, setFilters] = useState<ActivityFilters>({ page: 1, pageSize: 25 })
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading }   = useActivities(filters)
  const { data: stats }       = useActivityStats()

  function handlePageChange(page: number) {
    setFilters((f) => ({ ...f, page }))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Disparos</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {stats ? (
              <>
                <StatPill label="hoje"        value={stats.today}     color="var(--tenant-primary)" />
                <StatPill label="esta semana" value={stats.thisWeek}  color="#a78bfa" />
                <StatPill label="este mês"    value={stats.thisMonth} color="#fbbf24" />
              </>
            ) : (
              <div className="h-4 w-48 rounded animate-pulse" style={{ background: '#1e1e1e' }} />
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
      <div className="rounded-xl" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: '#1a1a1a' }}>
              <Zap size={26} style={{ color: '#333' }} />
            </div>
            <p className="font-medium" style={{ color: '#666' }}>Nenhum disparo encontrado</p>
            <p className="text-sm" style={{ color: '#444' }}>Ajuste os filtros ou registre o primeiro contato</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-4">
              {data.data.map((activity, index) => (
                <div key={activity.id} className={index > 0 ? 'pt-4' : ''}>
                  {index > 0 && <div className="mb-4" style={{ borderTop: '1px solid #1a1a1a' }} />}
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
              <div className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: '1px solid #1a1a1a' }}>
                <span className="text-sm" style={{ color: '#555' }}>
                  {data.count} disparo{data.count !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(data.page - 1)}
                    disabled={data.page <= 1}
                    className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: '#555' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm px-2" style={{ color: '#888' }}>
                    {data.page} / {data.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(data.page + 1)}
                    disabled={data.page >= data.totalPages}
                    className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: '#555' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
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
    <span className="text-sm" style={{ color: '#555' }}>
      <span className="font-bold" style={{ color }}>{value}</span> {label}
    </span>
  )
}
