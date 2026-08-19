import { useState } from 'react'
import { Plus, X, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { PeriodPicker } from '../components/PeriodPicker'
import { periodoDoMes, periodoAnterior, type Periodo } from '../periodo'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { FinancialSummaryCards } from '../components/FinancialSummary'
import { FinancialChart } from '../components/FinancialChart'
import { TransactionList } from '../components/TransactionList'
import { TransactionForm } from '../components/TransactionForm'
import { CatalogModal } from '../components/CatalogModal'
import { MRRSummary } from '../components/MRRSummary'
import { CashFlowForecast } from '../components/CashFlowForecast'
import { CategoryBreakdown } from '../components/CategoryBreakdown'
import { RevenuePieChart } from '../components/RevenuePieChart'
import { GoalCalculator } from '../components/GoalCalculator'
import { CarteiraContratos } from '../components/CarteiraContratos'
import { useFinancialSummary, useMonthlyTrend, useTransactions, useFaturamentoReceita } from '../hooks/useFinancial'
import { useFinancialMutations } from '../hooks/useFinancialMutations'
import { LeadDrawer } from '@/features/activities/components/LeadDrawer'
import { LeadForm } from '@/features/leads/components/LeadForm'
import { useLead } from '@/features/leads/hooks/useLead'
import type { FinancialRecord, FinancialFilters } from '@/services/financial'
import type { Lead } from '@/types'

const TYPE_OPTIONS = [
  { value: 'revenue', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
]

export function RevenuePage() {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoMes(new Date()))
  const { from, to, label } = periodo
  const { from: prevFrom, to: prevTo } = periodoAnterior(periodo)

  const [filters, setFilters]               = useState<FinancialFilters>({ page: 1, pageSize: 25 })
  const [editingRecord, setEditingRecord]   = useState<FinancialRecord | null | undefined>(undefined)
  const [deletingRecord, setDeletingRecord] = useState<FinancialRecord | null>(null)
  const [showCatalog, setShowCatalog]       = useState(false)
  const [openLeadId, setOpenLeadId]         = useState<string | null>(null)
  const [editingLead, setEditingLead]       = useState<Lead | null | undefined>(undefined)
  const { data: openedLead } = useLead(openLeadId)

  const { data: summary,     isLoading: summaryLoading } = useFinancialSummary(from, to)
  const { data: prevSummary } = useFinancialSummary(prevFrom, prevTo)
  const { data: faturamentoData } = useFaturamentoReceita(from, to)
  const { data: trend = [],  isLoading: trendLoading   } = useMonthlyTrend(12)
  const { data: transactions, isLoading: listLoading   } = useTransactions(filters)
  const { remove } = useFinancialMutations()
  const confirm = useConfirm()

  const hasFilters = !!(filters.type || filters.dateFrom || filters.dateTo)

  async function handleDelete(record: FinancialRecord) {
    const ok = await confirm({
      title: 'Excluir lançamento',
      message: `Excluir lançamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(record.amount)}?`,
      confirmLabel: 'Excluir', danger: true,
    })
    if (!ok) return
    await remove.mutateAsync(record.id)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Revenue Center</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>Financeiro e projeções</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setShowCatalog(true)}>
            <LayoutGrid size={15} />
            Catálogo
          </Button>
          <Button onClick={() => setEditingRecord(null)}>
            <Plus size={15} />
            Novo Lançamento
          </Button>
        </div>
      </div>

      <PeriodPicker periodo={periodo} onChange={setPeriodo} />

      {/* Cards do mês em foco: Faturamento (vendido) → Receita (recebido) →
          Despesas → Lucro → Margem, com comparação vs mês anterior */}
      <FinancialSummaryCards
        data={summary}
        previousData={prevSummary}
        faturamento={faturamentoData?.faturamento}
        wonCount={faturamentoData?.wonCount}
        isLoading={summaryLoading}
        periodLabel={label}
      />

      {/* MRR ativo */}
      <MRRSummary />

      {/* Gráfico de tendência 12 meses */}
      <FinancialChart data={trend} isLoading={trendLoading} />

      {/* Previsão de caixa + breakdown por categoria */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CashFlowForecast />
        <CategoryBreakdown dateFrom={from} dateTo={to} periodLabel={label} />
      </div>

      {/* Pizza de receita por categoria */}
      <CarteiraContratos from={from} to={to} periodLabel={label} />

      <RevenuePieChart dateFrom={from} dateTo={to} periodLabel={label} />

      {/* Calculadora de meta */}
      <GoalCalculator />

      {/* Filtros da lista (independentes do período em foco acima) */}
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
        <DatePicker
          label="De" placeholder="Data início" className="w-36"
          value={filters.dateFrom ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, dateFrom: v || undefined, page: 1 }))}
        />
        <DatePicker
          label="Até" placeholder="Data fim" className="w-36"
          value={filters.dateTo ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, dateTo: v || undefined, page: 1 }))}
        />
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
        onOpenLead={setOpenLeadId}
      />

      {/* Modal criar / editar */}
      <TransactionForm
        open={editingRecord !== undefined}
        onClose={() => setEditingRecord(undefined)}
        transaction={editingRecord ?? null}
      />

      {/* Catálogo de categorias e produtos/serviços */}
      <CatalogModal open={showCatalog} onClose={() => setShowCatalog(false)} />

      {/* Card do lead — aberto ao clicar "Ver no lead" numa conversão automática */}
      <LeadDrawer
        lead={openedLead ?? null}
        onClose={() => setOpenLeadId(null)}
        onEdit={(l) => { setOpenLeadId(null); setEditingLead(l) }}
        initialTab="contract"
      />
      <LeadForm
        open={editingLead !== undefined}
        onClose={() => setEditingLead(undefined)}
        lead={editingLead ?? null}
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
