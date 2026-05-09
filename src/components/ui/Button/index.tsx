import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?:    Size
  loading?: boolean
}

const sizes: Record<Size, string> = {
  sm: 'h-8  px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, style, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none'

    // Estilos inline para usar as CSS variables do white-label
    const variantStyle: React.CSSProperties =
      variant === 'primary'   ? { background: 'var(--tenant-primary)', color: '#000', boxShadow: '0 0 14px var(--tenant-primary-glow)' }
      : variant === 'secondary' ? { background: '#1c1c1c', color: '#cccccc', border: '1px solid #2a2a2a' }
      : variant === 'ghost'     ? { background: 'transparent', color: '#888888' }
      : variant === 'danger'    ? { background: '#2a0a0a', color: '#ff4444', border: '1px solid #3a1212' }
      : {}

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, sizes[size], className)}
        style={{ ...variantStyle, ...style }}
        onMouseEnter={(e) => {
          if (variant === 'primary') {
            e.currentTarget.style.filter = 'brightness(1.1)'
          } else if (variant === 'secondary') {
            e.currentTarget.style.borderColor = 'var(--tenant-primary)'
            e.currentTarget.style.color = 'var(--tenant-primary)'
          } else if (variant === 'ghost') {
            e.currentTarget.style.background = '#1a1a1a'
            e.currentTarget.style.color = '#cccccc'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = ''
          if (variant === 'secondary') {
            e.currentTarget.style.borderColor = '#2a2a2a'
            e.currentTarget.style.color = '#cccccc'
          } else if (variant === 'ghost') {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#888888'
          }
        }}
        {...props}
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
