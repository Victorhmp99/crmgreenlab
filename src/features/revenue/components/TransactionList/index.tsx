import { Pencil, Trash2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { FinancialRecord, PaginatedTransactions } from '@/services/financial'

interface TransactionListProps {
  result?:      PaginatedTransactions
  isLoading:    boolean
  onEdit:       (record: FinancialRecord) => void
  onDelete:     (record: FinancialRecord) => void
  onPageChange: (page: number) => void
  onOpenLead:   (leadId: string) => void
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function isAutoRow(record: FinancialRecord): boolean {
  return record.id.startsWith('lead-') || record.id.startsWith('contract-')
}

function SkeletonRow() {
  return (
    <tr>
      {[30, 50, 40, 20, 25].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded animate-pulse" style={{ width: `${w}%`, background: '#1e1e1e' }} />
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="h-4 w-12 rounded animate-pulse" style={{ background: '#1e1e1e' }} />
      </td>
    </tr>
  )
}

export function TransactionList({ result, isLoading, onEdit, onDelete, onPageChange, onOpenLead }: TransactionListProps) {
  const records = result?.data ?? []

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
              {['Data', 'Descrição', 'Categoria', 'Lead', 'Valor', 'Ações'].map((h, i) => (
                <th key={h}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${i >= 4 ? 'text-right' : 'text-left'}`}
                  style={{ color: '#444' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : records.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-sm" style={{ color: '#444' }}>
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              )
              : records.map((record) => {
                const auto = isAutoRow(record)
                return (
                <tr key={record.id}
                  style={{ borderBottom: '1px solid #191919' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#666' }}>
                    {formatDate(record.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {record.type === 'revenue'
                        ? <TrendingUp  size={14} className="shrink-0" style={{ color: '#00e676' }} />
                        : <TrendingDown size={14} className="shrink-0" style={{ color: '#ff4444' }} />
                      }
                      <span className="truncate max-w-[200px]" style={{ color: '#e8e8e8' }}>
                        {record.description || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {record.category ? (
                      <span className="text-xs rounded-full px-2.5 py-1"
                        style={{ background: '#1e1e1e', color: '#888' }}>
                        {record.category}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#333' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>
                    {record.lead_name ?? <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold tabular-nums"
                      style={{ color: record.type === 'revenue' ? '#00e676' : '#ff4444' }}>
                      {record.type === 'expense' ? '−' : '+'}{formatBRL(record.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {auto ? (
                        <button
                          onClick={() => onOpenLead(record.lead_id!)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ color: '#555' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,230,118,0.08)'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#555'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          }}
                          title="Editar pelo card do lead (aba Financeiro)"
                        >
                          <Pencil size={13} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => onEdit(record)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: '#555' }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
                              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,230,118,0.08)'
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = '#555'
                              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => onDelete(record)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: '#555' }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'
                              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.08)'
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = '#555'
                              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )})
            }
          </tbody>
        </table>
      </div>

      {!isLoading && result && result.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid #1a1a1a' }}>
          <span className="text-sm" style={{ color: '#555' }}>
            {result.count} lançamento{result.count !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(result.page - 1)} disabled={result.page <= 1}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: '#555' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm px-2" style={{ color: '#888' }}>{result.page} / {result.totalPages}</span>
            <button onClick={() => onPageChange(result.page + 1)} disabled={result.page >= result.totalPages}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: '#555' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-2" style={{ borderTop: '1px solid #1a1a1a' }}>
          <Spinner size="sm" />
        </div>
      )}
    </div>
  )
}
