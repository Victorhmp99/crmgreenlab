import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Phone, Mail, Tag, Zap, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LeadStatusBadge } from '@/features/leads/components/LeadStatusBadge'
import { LeadSourceBadge } from '@/features/leads/components/LeadSourceBadge'
import { LeadTimeline } from '../LeadTimeline'
import { ActivityForm } from '../ActivityForm'
import { formatPhone } from '@/lib/utils'
import type { Lead } from '@/types'

interface LeadDrawerProps {
  lead:    Lead | null
  onClose: () => void
  onEdit:  (lead: Lead) => void
}

export function LeadDrawer({ lead, onClose, onEdit }: LeadDrawerProps) {
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (lead) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [lead])

  useEffect(() => {
    if (!lead) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lead, onClose])

  if (!lead) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 backdrop-blur-[2px] transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Painel */}
      <div
        className={`relative z-10 w-full max-w-md flex flex-col h-full transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: '#0f0f0f', borderLeft: '1px solid #1e1e1e' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-base font-semibold truncate" style={{ color: '#e8e8e8' }}>{lead.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <LeadStatusBadge status={lead.status} />
              <LeadSourceBadge source={lead.source} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(lead)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,230,118,0.08)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#555'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
              title="Editar lead"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#aaa'
                ;(e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#555'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Dados do lead */}
        <div className="px-5 py-4 shrink-0 flex flex-col gap-2.5"
          style={{ borderBottom: '1px solid #1a1a1a' }}>
          {lead.phone && (
            <div className="flex items-center gap-2.5 text-sm" style={{ color: '#888' }}>
              <Phone size={15} className="shrink-0" style={{ color: '#555' }} />
              <a href={`tel:${lead.phone}`} className="transition-colors"
                style={{ color: '#888' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}>
                {formatPhone(lead.phone)}
              </a>
              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs font-medium flex items-center gap-1 shrink-0 transition-colors"
                style={{ color: '#00e676' }}
              >
                <span>●</span> WhatsApp
              </a>
            </div>
          )}

          {lead.email && (
            <div className="flex items-center gap-2.5 text-sm" style={{ color: '#888' }}>
              <Mail size={15} className="shrink-0" style={{ color: '#555' }} />
              <a href={`mailto:${lead.email}`} className="truncate transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}>
                {lead.email}
              </a>
            </div>
          )}

          {lead.tags.length > 0 && (
            <div className="flex items-start gap-2.5">
              <Tag size={15} className="shrink-0 mt-0.5" style={{ color: '#555' }} />
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((tag) => (
                  <span key={tag} className="text-xs rounded-full px-2.5 py-0.5"
                    style={{ background: '#1e1e1e', color: '#888' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lead.notes && (
            <div className="mt-1 rounded-xl px-3 py-2.5 text-sm leading-relaxed"
              style={{ background: '#141414', border: '1px solid #1e1e1e', color: '#888' }}>
              {lead.notes}
            </div>
          )}
        </div>

        {/* Seção de disparos */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid #1a1a1a' }}>
          <span className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Histórico de Disparos</span>
          <Button size="sm" onClick={() => setShowActivityForm(true)}>
            <Zap size={13} />
            Registrar
          </Button>
        </div>

        {/* Timeline com scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <LeadTimeline
            leadId={lead.id}
            onRegister={() => setShowActivityForm(true)}
          />
        </div>
      </div>

      <ActivityForm
        open={showActivityForm}
        onClose={() => setShowActivityForm(false)}
        presetLeadId={lead.id}
        presetLeadName={lead.name}
      />
    </div>,
    document.body,
  )
}
