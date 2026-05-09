import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { FinancialSummaryCards } from '../components/FinancialSummary'
import { FinancialChart } from '../components/FinancialChart'
import { TransactionList } from '../components/TransactionList'
import { TransactionForm } from '../components/TransactionForm'
import { useFinancialSummary, useMonthlyTrend, useTransactions } from '../hooks/useFinancial'
import { useFinancialMutations } from '../hooks/useFinancialMutations'
import type { FinancialRecord, FinancialFilters } from '@/services/financial'

// Período atual: primeiro e último dia do mês corrente
function currentMonth() {
  const now   = new Date()
  const from  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const label = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return { from, to, label }
}

const TYPE_OPTIONS = [
  { value: 'revenue', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
]

export function RevenuePage() {
  const { from, to, label } = currentMonth()

  const [filters, setFilters]               = useState<FinancialFilters>({ page: 1, pageSize: 25 })
  const [editingRecord, setEditingRecord]   = useState<FinancialRecord | null | undefined>(undefined)
  const [deletingRecord, setDeletingRecord] = useState<FinancialRecord | null>(null)

  const { data: summary,     isLoading: summaryLoading } = useFinancialSummary(from, to)
  const { data: trend = [],  isLoading: trendLoading   } = useMonthlyTrend(12)
  const { data: transactions, isLoading: listLoading   } = useTransactions(filters)
  const { remove } = useFinancialMutations()

  const hasFilters = !!(filters.type || filters.dateFrom || filters.dateTo)

  async function handleDelete(record: FinancialRecord) {
    if (!confirm(`Excluir lançamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(record.amount)}?`)) return
    await remove.mutateAsync(record.id)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Revenue Center</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>Financeiro e projeções</p>
        </div>
        <Button onClick={() => setEditingRecord(null)}>
          <Plus size={15} />
          Novo Lançamento
        </Button>
      </div>

      {/* Cards do mês atual */}
      <FinancialSummaryCards data={summary} isLoading={summaryLoading} periodLabel={label} />

      {/* Gráfico de tendência 12 meses */}
      <FinancialChart data={trend} isLoading={trendLoading} />

      {/* Filtros da lista */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-40">
          <Select
            label="Tipo"
            value={filters.type ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as FinancialFilters['type'], page: 1 }))}
            options={TYPE_OPTIONS}
            placeholder="Todos"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>De</label>
          <Input type="date" value={filters.dateFrom ?? ''} className="w-36"
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Até</label>
          <Input type="date" value={filters.dateTo ?? ''} className="w-36"
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))} />
        </div>
        {hasFilters && (
          <button
            onClick={() => setFilters({ page: 1, pageSize: 25 })}
            className="flex items-center gap-1.5 h-10 text-sm transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Tabela de lançamentos */}
      <TransactionList
        result={transactions}
        isLoading={listLoading}
        onEdit={setEditingRecord}
        onDelete={handleDelete}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
      />

      {/* Modal criar / editar */}
      <TransactionForm
        open={editingRecord !== undefined}
        onClose={() => setEditingRecord(undefined)}
        transaction={editingRecord ?? null}
      />

      {/* Confirm delete */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingRecord(null)} />
          <div className="relative z-10 rounded-2xl p-6 max-w-sm w-full text-center"
            style={{ background: '#111111', border: '1px solid #2a2a2a', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}>
            <p className="font-semibold mb-2" style={{ color: '#e8e8e8' }}>Excluir lançamento?</p>
            <p className="text-sm mb-5" style={{ color: '#666' }}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" onClick={() => setDeletingRecord(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => { handleDelete(deletingRecord); setDeletingRecord(null) }}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
