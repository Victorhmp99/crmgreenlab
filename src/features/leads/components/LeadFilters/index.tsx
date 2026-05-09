import { Search, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { STATUS_OPTIONS } from '../LeadStatusBadge'
import { SOURCE_OPTIONS } from '../LeadSourceBadge'
import type { LeadFilters } from '@/services/leads'

interface LeadFiltersBarProps {
  filters: LeadFilters
  onChange: (filters: LeadFilters) => void
}

export function LeadFiltersBar({ filters, onChange }: LeadFiltersBarProps) {
  const hasActiveFilters = !!(filters.search || filters.status || filters.source)

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Busca */}
      <div className="relative flex-1 min-w-48">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
          className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-colors"
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

      {/* Limpar filtros */}
      {hasActiveFilters && (
        <button
          onClick={() => onChange({ page: 1, pageSize: filters.pageSize })}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X size={14} />
          Limpar
        </button>
      )}
    </div>
  )
}
