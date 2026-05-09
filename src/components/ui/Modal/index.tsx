import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open:         boolean
  onClose:      () => void
  title:        string
  description?: string
  size?:        'sm' | 'md' | 'lg' | 'xl'
  children:     ReactNode
  footer?:      ReactNode
}

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, onClose, title, description, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose} aria-hidden />

      {/* Painel */}
      <div
        className={cn('relative z-10 w-full rounded-2xl flex flex-col max-h-[90vh]', sizes[size])}
        style={{ background: '#111111', border: '1px solid #2a2a2a', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}
        role="dialog" aria-modal aria-label={title}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 shrink-0"
          style={{ borderBottom: '1px solid #1e1e1e' }}>
          <div>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: '#e8e8e8' }}>{title}</h2>
            {description && <p className="text-xs mt-0.5" style={{ color: '#666' }}>{description}</p>}
          </div>
          <button onClick={onClose}
            className="ml-4 p-1.5 rounded-lg transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#555' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0 rounded-b-2xl"
            style={{ borderTop: '1px solid #1e1e1e', background: '#0d0d0d' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
