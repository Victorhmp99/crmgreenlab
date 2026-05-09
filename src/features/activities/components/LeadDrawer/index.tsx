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

  // Animação de entrada/saída
  useEffect(() => {
    if (lead) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [lead])

  // Fecha com Escape
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
        className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Painel */}
      <div
        className={`relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full
          transition-transform duration-300 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-base font-semibold text-slate-900 truncate">{lead.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <LeadStatusBadge status={lead.status} />
              <LeadSourceBadge source={lead.source} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(lead)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Editar lead"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Dados do lead */}
        <div className="px-5 py-4 border-b border-slate-100 shrink-0 flex flex-col gap-2.5">
          {lead.phone && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <Phone size={15} className="text-slate-400 shrink-0" />
              <a
                href={`tel:${lead.phone}`}
                className="hover:text-blue-600 transition-colors"
              >
                {formatPhone(lead.phone)}
              </a>
              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1 shrink-0"
              >
                <span className="text-green-500">●</span> WhatsApp
              </a>
            </div>
          )}

          {lead.email && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <Mail size={15} className="text-slate-400 shrink-0" />
              <a href={`mailto:${lead.email}`} className="truncate hover:text-blue-600 transition-colors">
                {lead.email}
              </a>
            </div>
          )}

          {lead.tags.length > 0 && (
            <div className="flex items-start gap-2.5">
              <Tag size={15} className="text-slate-400 shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lead.notes && (
            <div className="mt-1 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm text-slate-600 leading-relaxed">
              {lead.notes}
            </div>
          )}
        </div>

        {/* Seção de disparos */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
          <span className="text-sm font-semibold text-slate-700">Histórico de Disparos</span>
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

      {/* Modal de registro dentro do drawer */}
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
