import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  glow?:    boolean
}

const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }

export function Card({ className, padding = 'md', glow = false, style, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-xl transition-all', paddings[padding], className)}
      style={{
        background:   '#141414',
        border:       '1px solid #1e1e1e',
        boxShadow:    glow ? '0 0 20px rgba(0,230,118,0.08)' : undefined,
        ...style,
      }}
      {...props}
    />
  )
}
