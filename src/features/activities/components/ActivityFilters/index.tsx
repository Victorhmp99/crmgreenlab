import { X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
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

      <DatePicker
        label="De" placeholder="Data início" className="w-36"
        value={filters.dateFrom ?? ''}
        onChange={(v) => onChange({ ...filters, dateFrom: v || undefined, page: 1 })}
      />

      <DatePicker
        label="Até" placeholder="Data fim" className="w-36"
        value={filters.dateTo ?? ''}
        onChange={(v) => onChange({ ...filters, dateTo: v || undefined, page: 1 })}
      />

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
