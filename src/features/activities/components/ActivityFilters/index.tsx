import { X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { ACTIVITY_CONFIG, MANUAL_ACTIVITY_TYPES } from '../ActivityTypeIcon'
import type { ActivityFilters } from '@/services/activities'
import type { ActivityType } from '@/types'

interface ActivityFiltersBarProps {
  filters:  ActivityFilters
  onChange: (f: ActivityFilters) => void
}

const TYPE_OPTIONS = [
  ...MANUAL_ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_CONFIG[t].label })),
  { value: 'stage_change', label: ACTIVITY_CONFIG.stage_change.label },
]

export function ActivityFiltersBar({ filters, onChange }: ActivityFiltersBarProps) {
  const hasActive = !!(filters.type || filters.dateFrom || filters.dateTo)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <Select
          label="Tipo"
          value={filters.type ?? ''}
          onChange={(e) =>
            onChange({ ...filters, type: e.target.value as ActivityType | '', page: 1 })
          }
          options={TYPE_OPTIONS}
          placeholder="Todos os tipos"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>De</label>
        <Input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value, page: 1 })}
          className="w-36"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Até</label>
        <Input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value, page: 1 })}
          className="w-36"
        />
      </div>

      {hasActive && (
        <button
          onClick={() => onChange({ page: 1, pageSize: filters.pageSize })}
          className="flex items-center gap-1.5 h-10 text-sm transition-colors"
          style={{ color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
        >
          <X size={14} /> Limpar
        </button>
      )}
    </div>
  )
}
