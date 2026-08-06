import { useState } from 'react'
import { Zap, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { ActivityItem } from '../components/ActivityItem'
import { ActivityFiltersBar } from '../components/ActivityFilters'
import { ActivityForm } from '../components/ActivityForm'
import { useActivities, useActivityStats } from '../hooks/useActivities'
import { useActivityMutations } from '../hooks/useActivityMutations'
import { useAuthStore } from '@/store/authStore'
import type { ActivityFilters } from '@/services/activities'

export function ActivitiesPage() {
  const [filters, setFilters] = useState<ActivityFilters>({ page: 1, pageSize: 25 })
  const [showForm, setShowForm] = useState(false)

  // Modo seleção em massa
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [confirmBulk,   setConfirmBulk]   = useState(false)

  const role         = useAuthStore((s) => s.membership?.role)
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const canBulkDelete = role === 'admin' || role === 'manager' || isSuperAdmin

  const { data, isLoading }   = useActivities(filters)
  const { data: stats }       = useActivityStats()
  const { removeMany }        = useActivityMutations()

  function handlePageChange(page: number) {
    setFilters((f) => ({ ...f, page }))
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAllPage() {
    if (!data) return
    const pageIds = data.data.map((a) => a.id)
    setSelectedIds((prev) => {
      const allSelected = pageIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) pageIds.forEach((id) => next.delete(id))
      else             pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function exitSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    await removeMany.mutateAsync(ids)
    exitSelection()
    setConfirmBulk(false)
  }

  const allOnPageSelected = data
    ? data.data.length > 0 && data.data.every((a) => selectedIds.has(a.id))
    : false

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Movimentações</h2>
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
        <div className="flex items-center gap-2 shrink-0">
          {canBulkDelete && !selectionMode && (
            <Button variant="secondary" onClick={() => setSelectionMode(true)}>
              <CheckSquare size={15} />
              Selecionar
            </Button>
          )}
          {!selectionMode && (
            <Button onClick={() => setShowForm(true)}>
              <Zap size={15} />
              Registrar atividade
            </Button>
          )}
        </div>
      </div>

      {/* Barra de ações em massa */}
      {selectionMode && (
        <BulkActionBar
          count={selectedIds.size}
          label="movimentação"
          onCancel={exitSelection}
          onDelete={() => setConfirmBulk(true)}
          deleting={removeMany.isPending}
        />
      )}

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
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: '#1a1a1a' }}>
              <Zap size={26} style={{ color: '#333' }} />
            </div>
            <p className="font-medium" style={{ color: '#666' }}>Nenhuma movimentação encontrada</p>
            <p className="text-sm" style={{ color: '#444' }}>Ajuste os filtros ou registre o primeiro contato</p>
          </div>
        ) : (
          <>
            {/* "Selecionar todos da página" */}
            {selectionMode && (
              <div className="px-5 py-2.5 flex items-center gap-2"
                style={{ borderBottom: '1px solid #1a1a1a', background: '#0f0f0f' }}>
                <button onClick={toggleSelectAllPage}
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: allOnPageSelected ? '#00e676' : '#666' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#00e676')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = allOnPageSelected ? '#00e676' : '#666')}>
                  {allOnPageSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                  {allOnPageSelected ? 'Desmarcar todos desta página' : `Selecionar todos desta página (${data.data.length})`}
                </button>
              </div>
            )}

            <div className="px-5 py-4">
              {data.data.map((activity, index) => (
                <div key={activity.id} className={index > 0 ? 'pt-4' : ''}>
                  {index > 0 && <div className="mb-4" style={{ borderTop: '1px solid #1a1a1a' }} />}
                  <ActivityItem
                    activity={activity}
                    showLead
                    isLast={index === data.data.length - 1}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(activity.id)}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
            </div>

            {/* Paginação */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: '1px solid #1a1a1a' }}>
                <span className="text-sm" style={{ color: '#555' }}>
                  {data.count} movimentaç{data.count !== 1 ? 'ões' : 'ão'}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePageChange(data.page - 1)} disabled={data.page <= 1}
                    className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: '#555' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm px-2" style={{ color: '#888' }}>
                    {data.page} / {data.totalPages}
                  </span>
                  <button onClick={() => handlePageChange(data.page + 1)} disabled={data.page >= data.totalPages}
                    className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: '#555' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ActivityForm open={showForm} onClose={() => setShowForm(false)} />

      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setConfirmBulk(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#141414', border: '1px solid #2a2a2a' }}>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: '#ff4444' }}>
                Excluir {selectedIds.size} movimentaç{selectedIds.size !== 1 ? 'ões' : 'ão'}?
              </h3>
              <p className="text-sm mt-1" style={{ color: '#888' }}>
                Esta ação não pode ser desfeita. As movimentações serão excluídas permanentemente.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmBulk(false)} disabled={removeMany.isPending}
                className="rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-40"
                style={{ color: '#aaa', border: '1px solid #2a2a2a' }}>
                Cancelar
              </button>
              <button onClick={handleBulkDelete} disabled={removeMany.isPending}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ background: 'rgba(255,68,68,0.15)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.4)' }}>
                {removeMany.isPending ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
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
