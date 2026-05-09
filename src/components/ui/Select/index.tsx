import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectOption { value: string; label: string }
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:       string
  error?:       string
  options:      SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium uppercase tracking-wide"
            style={{ color: '#888888' }}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn('h-10 w-full appearance-none rounded-lg px-3 pr-8 text-sm transition-all duration-150 focus:outline-none', className)}
            style={{
              background:   '#1a1a1a',
              border:       `1px solid ${error ? '#ff4444' : '#2a2a2a'}`,
              color:        '#e8e8e8',
            }}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a', color: '#e8e8e8' }}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: '#555' }} />
        </div>
        {error && <p className="text-xs" style={{ color: '#ff4444' }}>{error}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'
