import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { LeadStatusBadge } from '@/features/leads/components/LeadStatusBadge'
import { LeadSourceBadge } from '@/features/leads/components/LeadSourceBadge'
import { formatDate, formatPhone } from '@/lib/utils'
import type { Lead } from '@/types'

interface RecentLeadsTableProps {
  leads: Lead[]
  isLoading?: boolean
}

function SkeletonRow() {
  return (
    <tr>
      {[60, 40, 50, 30, 35].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 rounded bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function RecentLeadsTable({ leads, isLoading }: RecentLeadsTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-700">Leads Recentes</p>
          <p className="text-xs text-slate-400 mt-0.5">Últimos cadastros do sistema</p>
        </div>
        <Link
          to="/leads"
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          Ver todos <ArrowRight size={13} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Nome</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Telefone</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Origem</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : leads.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                    Nenhum lead cadastrado ainda
                  </td>
                </tr>
              )
              : leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{lead.name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {lead.phone ? formatPhone(lead.phone) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <LeadSourceBadge source={lead.source} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {formatDate(lead.created_at)}
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
