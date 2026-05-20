import { Pencil, Trash2, ChevronLeft, ChevronRight, UserX, CheckSquare, Square } from 'lucide-react'
import { LeadStatusBadge } from '../LeadStatusBadge'
import { LeadSourceBadge } from '../LeadSourceBadge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatPhone, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { Lead } from '@/types'
import type { PaginatedLeads } from '@/services/leads'

interface LeadTableProps {
  result?: PaginatedLeads
  isLoading: boolean
  onEdit:       (lead: Lead) => void
  onDelete:     (lead: Lead) => void
  onSelect:     (lead: Lead) => void
  onPageChange: (page: number) => void
  /** Quando true, mostra checkboxes pra seleção em massa */
  selectionMode?: boolean
  selectedIds?:   Set<string>
  onToggleSelect?:    (id: string) => void
  onToggleSelectAll?: (allIds: string[]) => void
}

function SkeletonRow({ extraColumn = false }: { extraColumn?: boolean }) {
  const cols = (extraColumn ? 1 : 0) + 6
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 40}%`, background: '#1e1e1e' }} />
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="h-4 w-16 rounded animate-pulse" style={{ background: '#1e1e1e' }} />
      </td>
    </tr>
  )
}

interface PaginationProps {
  page: number; totalPages: number; count: number; pageSize: number
  onPage: (page: number) => void
}

function Pagination({ page, totalPages, count, pageSize, onPage }: PaginationProps) {
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, count)

  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #1a1a1a' }}>
      <span className="text-sm" style={{ color: '#555' }}>
        {count === 0 ? '0 resultados' : `${from}–${to} de ${count} lead${count !== 1 ? 's' : ''}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: '#555' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm px-2" style={{ color: '#888' }}>
          {page} / {totalPages || 1}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: '#555' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function LeadTable({
  result, isLoading, onEdit, onDelete, onSelect, onPageChange,
  selectionMode = false, selectedIds, onToggleSelect, onToggleSelectAll,
}: LeadTableProps) {
  const leads = result?.data ?? []
  const allSelectedOnPage = leads.length > 0 && leads.every((l) => selectedIds?.has(l.id))
  const totalCols = selectionMode ? 9 : 8

  // Permissão de excluir: admin, gestor ou super admin. Vendedor não vê o botão.
  const role         = useAuthStore((s) => s.membership?.role)
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const canDeleteLead = role === 'admin' || role === 'manager' || isSuperAdmin

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1a1a1a', background: '#111' }}>
              {selectionMode && (
                <th className="px-3 py-3 w-8">
                  <button onClick={() => onToggleSelectAll?.(leads.map((l) => l.id))}
                    title={allSelectedOnPage ? 'Desmarcar todos' : 'Selecionar todos desta página'}
                    className="h-5 w-5 rounded flex items-center justify-center transition-colors"
                    style={{ color: allSelectedOnPage ? '#00e676' : '#555' }}>
                    {allSelectedOnPage ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                </th>
              )}
              {['Nome', 'Telefone', 'E-mail', 'Valor', 'Status', 'Origem', 'Cadastro', 'Ações'].map((h, i) => (
                <th key={h}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${i === 7 ? 'text-right' : 'text-left'}`}
                  style={{ color: '#444' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} extraColumn={selectionMode} />)
              : leads.length === 0
              ? (
                <tr>
                  <td colSpan={totalCols} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserX size={32} style={{ color: '#333' }} />
                      <p className="font-medium" style={{ color: '#555' }}>Nenhum lead encontrado</p>
                      <p className="text-xs" style={{ color: '#444' }}>Tente ajustar os filtros ou cadastre um novo lead</p>
                    </div>
                  </td>
                </tr>
              )
              : leads.map((lead) => {
                const isSelected = selectedIds?.has(lead.id) ?? false
                return (
                <tr key={lead.id}
                  className="transition-colors"
                  style={{
                    borderBottom: '1px solid #191919',
                    background: isSelected ? 'rgba(0,230,118,0.04)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '#191919' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isSelected ? 'rgba(0,230,118,0.04)' : 'transparent' }}>
                  {selectionMode && (
                    <td className="px-3 py-3">
                      <button onClick={() => onToggleSelect?.(lead.id)}
                        className="h-5 w-5 rounded flex items-center justify-center transition-colors"
                        style={{ color: isSelected ? '#00e676' : '#555' }}>
                        {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => selectionMode ? onToggleSelect?.(lead.id) : onSelect(lead)}
                      className="font-medium text-left transition-colors block"
                      style={{ color: '#e8e8e8' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#e8e8e8')}
                    >
                      {lead.name}
                    </button>
                    {lead.company_name && (
                      <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                        {lead.company_name}
                      </p>
                    )}
                    {lead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lead.tags.map((tag) => (
                          <span key={tag} className="text-[10px] rounded px-1.5 py-0.5"
                            style={{ background: '#1e1e1e', color: '#666' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#777' }}>
                    {lead.phone ? formatPhone(lead.phone) : <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: '#777' }}>
                    {lead.email ?? <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {lead.value != null && Number(lead.value) > 0
                      ? <span style={{ color: '#00e676', fontWeight: 600 }}>{formatCurrency(Number(lead.value))}</span>
                      : <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <LeadSourceBadge source={lead.source} />
                    {lead.source_campaign && (
                      <p className="text-[10px] mt-0.5 truncate max-w-[120px]" style={{ color: '#444' }}>
                        {lead.source_campaign}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#666' }}>
                    {formatDate(lead.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
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
                      {canDeleteLead && (
                        <button
                          onClick={() => onDelete(lead)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ color: '#555' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.08)'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#555'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          }}
                          title="Excluir lead"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
              })
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
        <div className="flex justify-center py-3" style={{ borderTop: '1px solid #1a1a1a' }}>
          <Spinner size="sm" />
        </div>
      )}
    </div>
  )
}
