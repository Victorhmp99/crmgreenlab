import { Pencil, Trash2, ChevronLeft, ChevronRight, UserX } from 'lucide-react'
import { LeadStatusBadge } from '../LeadStatusBadge'
import { LeadSourceBadge } from '../LeadSourceBadge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatPhone } from '@/lib/utils'
import type { Lead } from '@/types'
import type { PaginatedLeads } from '@/services/leads'

interface LeadTableProps {
  result?: PaginatedLeads
  isLoading: boolean
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onSelect: (lead: Lead) => void
  onPageChange: (page: number) => void
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </td>
      ))}
      <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-slate-100 animate-pulse" /></td>
    </tr>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  count: number
  pageSize: number
  onPage: (page: number) => void
}

function Pagination({ page, totalPages, count, pageSize, onPage }: PaginationProps) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <span className="text-sm text-slate-500">
        {count === 0 ? '0 resultados' : `${from}–${to} de ${count} lead${count !== 1 ? 's' : ''}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-slate-700 px-2">
          {page} / {totalPages || 1}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function LeadTable({ result, isLoading, onEdit, onDelete, onSelect, onPageChange }: LeadTableProps) {
  const leads = result?.data ?? []

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Telefone</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">E-mail</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Origem</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Cadastro</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : leads.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <UserX size={32} className="text-slate-300" />
                      <p className="font-medium">Nenhum lead encontrado</p>
                      <p className="text-xs">Tente ajustar os filtros ou cadastre um novo lead</p>
                    </div>
                  </td>
                </tr>
              )
              : leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onSelect(lead)}
                      className="font-medium text-slate-900 hover:text-blue-600 transition-colors text-left"
                    >
                      {lead.name}
                    </button>
                    {lead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lead.tags.map((tag) => (
                          <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {lead.phone ? formatPhone(lead.phone) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                    {lead.email ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <LeadSourceBadge source={lead.source} />
                    {lead.source_campaign && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                        {lead.source_campaign}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(lead.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(lead)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar lead"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(lead)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Excluir lead"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {!isLoading && result && result.totalPages > 0 && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          count={result.count}
          pageSize={result.pageSize}
          onPage={onPageChange}
        />
      )}

      {isLoading && (
        <div className="flex justify-center py-3 border-t border-slate-100">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  )
}
