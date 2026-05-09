import { Pencil, Trash2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { FinancialRecord, PaginatedTransactions } from '@/services/financial'

interface TransactionListProps {
  result?:       PaginatedTransactions
  isLoading:     boolean
  onEdit:        (record: FinancialRecord) => void
  onDelete:      (record: FinancialRecord) => void
  onPageChange:  (page: number) => void
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function SkeletonRow() {
  return (
    <tr>
      {[30, 50, 40, 20, 25].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
      <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-slate-100 animate-pulse" /></td>
    </tr>
  )
}

export function TransactionList({ result, isLoading, onEdit, onDelete, onPageChange }: TransactionListProps) {
  const records = result?.data ?? []

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Data</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Descrição</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Categoria</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Lead</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Valor</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : records.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400 text-sm">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              )
              : records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(record.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {record.type === 'revenue'
                        ? <TrendingUp  size={14} className="text-emerald-500 shrink-0" />
                        : <TrendingDown size={14} className="text-red-400     shrink-0" />
                      }
                      <span className="text-slate-700 truncate max-w-[200px]">
                        {record.description || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {record.category ? (
                      <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
                        {record.category}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {record.lead_name ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold tabular-nums ${
                      record.type === 'revenue' ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {record.type === 'expense' ? '−' : '+'}{formatBRL(record.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(record)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(record)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {!isLoading && result && result.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-sm text-slate-500">{result.count} lançamento{result.count !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(result.page - 1)} disabled={result.page <= 1}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-700 px-2">{result.page} / {result.totalPages}</span>
            <button onClick={() => onPageChange(result.page + 1)} disabled={result.page >= result.totalPages}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-2 border-t border-slate-100">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  )
}
