import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a' },
  success: { background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' },
  warning: { background: 'rgba(255,187,0,0.1)', color: '#ffbb00', border: '1px solid rgba(255,187,0,0.2)' },
  danger:  { background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.2)' },
  info:    { background: 'rgba(64,160,255,0.1)', color: '#40a0ff', border: '1px solid rgba(64,160,255,0.2)' },
}

export function Badge({ className, variant = 'default', children, style, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}
      style={{ ...BADGE_STYLES[variant], ...style }}
      {...props}
    >
      {children}
    </span>
  )
}
