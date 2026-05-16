import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?:  string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg px-3 text-sm transition-all duration-150',
            'focus:outline-none',
            className,
          )}
          style={{
            background:   'var(--bg-input)',
            border:       `1px solid ${error ? '#ff4444' : 'var(--border)'}`,
            color:        'var(--text)',
            boxShadow:    error ? '0 0 8px rgba(255,68,68,0.2)' : undefined,
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--tenant-primary)'
              e.currentTarget.style.boxShadow = '0 0 8px var(--tenant-primary-glow)'
            }
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = ''
            }
            props.onBlur?.(e)
          }}
          {...props}
        />
        {error && <p className="text-xs" style={{ color: '#ff4444' }}>{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
