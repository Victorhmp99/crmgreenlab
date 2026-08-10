import { Search, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { STATUS_OPTIONS } from '../LeadStatusBadge'
import { SOURCE_OPTIONS } from '../LeadSourceBadge'
import type { LeadFilters, LeadSortField } from '@/services/leads'

const SORT_OPTIONS: { label: string; value: LeadSortField }[] = [
  { label: 'Mais recentes (criação)', value: 'created_at' },
  { label: 'Mais recentes (atualiz.)', value: 'updated_at' },
]

interface LeadFiltersBarProps {
  filters:  LeadFilters
  onChange: (filters: LeadFilters) => void
}

export function LeadFiltersBar({ filters, onChange }: LeadFiltersBarProps) {
  const hasActiveFilters = !!(filters.search || filters.status || filters.source)

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Busca */}
      <div className="relative flex-1 min-w-48">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: '#444' }} />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
          className="h-10 w-full rounded-lg pl-9 pr-3 text-sm transition-all duration-150 focus:outline-none"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
          onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
          onBlur={(e) => (e.currentTarget.style.border = '1px solid #2a2a2a')}
        />
      </div>

      {/* Status */}
      <div className="w-40">
        <Select
          value={filters.status ?? ''}
          onChange={(e) => onChange({ ...filters, status: e.target.value as LeadFilters['status'], page: 1 })}
          options={STATUS_OPTIONS}
          placeholder="Todos os status"
          aria-label="Filtrar por status"
        />
      </div>

      {/* Origem */}
      <div className="w-44">
        <Select
          value={filters.source ?? ''}
          onChange={(e) => onChange({ ...filters, source: e.target.value as LeadFilters['source'], page: 1 })}
          options={SOURCE_OPTIONS}
          placeholder="Todas as origens"
          aria-label="Filtrar por origem"
        />
      </div>

      {/* Ordenar */}
      <div className="w-52">
        <Select
          value={filters.sortBy ?? 'created_at'}
          onChange={(e) => onChange({ ...filters, sortBy: e.target.value as LeadSortField, page: 1 })}
          options={SORT_OPTIONS}
          aria-label="Ordenar por"
        />
      </div>

      {/* Limpar filtros */}
      {hasActiveFilters && (
        <button
          onClick={() => onChange({ page: 1, pageSize: filters.pageSize, sortBy: filters.sortBy })}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
        >
          <X size={14} />
          Limpar
        </button>
      )}
    </div>
  )
}
