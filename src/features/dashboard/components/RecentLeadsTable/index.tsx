import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { LeadStatusBadge } from '@/features/leads/components/LeadStatusBadge'
import { LeadSourceBadge } from '@/features/leads/components/LeadSourceBadge'
import { formatDateTime, formatPhone } from '@/lib/utils'
import type { Lead } from '@/types'

interface RecentLeadsTableProps {
  leads:      Lead[]
  isLoading?: boolean
}

function SkeletonRow() {
  return (
    <tr>
      {[60, 40, 50, 30, 35].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 rounded animate-pulse" style={{ width: `${w}%`, background: '#1e1e1e' }} />
        </td>
      ))}
    </tr>
  )
}

export function RecentLeadsTable({ leads, isLoading }: RecentLeadsTableProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Leads Recentes</p>
          <p className="text-xs mt-0.5" style={{ color: '#444' }}>Últimos cadastros do sistema</p>
        </div>
        <Link
          to="/leads"
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: 'var(--tenant-primary)' }}
        >
          Ver todos <ArrowRight size={13} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1a1a1a', background: '#111' }}>
              {['Nome', 'Telefone', 'Status', 'Origem', 'Cadastro'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide"
                  style={{ color: '#444' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : leads.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm" style={{ color: '#444' }}>
                    Nenhum lead cadastrado ainda
                  </td>
                </tr>
              )
              : leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid #191919' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: '#e8e8e8' }}>{lead.name}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#666' }}>
                    {lead.phone ? formatPhone(lead.phone) : <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <LeadSourceBadge source={lead.source} />
                  </td>
                  <td className="px-4 py-3 text-[11px] whitespace-nowrap tabular-nums" style={{ color: '#666' }}>
                    {formatDateTime(lead.created_at)}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
