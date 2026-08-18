// Dados de demonstração do módulo financeiro (VITE_DEMO_MODE=true).
// Usado pra apresentar o produto sem depender de dados reais de nenhuma empresa.

import type {
  FinancialSummary, MonthlyPoint, PaginatedTransactions,
  CategoryBreakdown, CashFlowForecast, FinancialRecord,
} from '@/services/financial'
import type { FinancialCategory } from '@/services/financialCategories'
import type { FinancialProduct } from '@/services/financialProducts'
import type { MRRSummary } from '@/services/clientContracts'
import type { FaturamentoReceita } from '@/services/dashboard'

export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

const TENANT = 'demo-tenant-id'

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const DEMO_CATEGORIES: FinancialCategory[] = [
  { id: 'c1', tenant_id: TENANT, name: 'Gestão de Tráfego', type: 'revenue', active: true, created_at: '' },
  { id: 'c2', tenant_id: TENANT, name: 'Consultoria',        type: 'revenue', active: true, created_at: '' },
  { id: 'c3', tenant_id: TENANT, name: 'Criativos',          type: 'revenue', active: true, created_at: '' },
  { id: 'c4', tenant_id: TENANT, name: 'Anúncios',           type: 'expense', active: true, created_at: '' },
  { id: 'c5', tenant_id: TENANT, name: 'Software',           type: 'expense', active: true, created_at: '' },
  { id: 'c6', tenant_id: TENANT, name: 'Equipe',             type: 'expense', active: true, created_at: '' },
]

export const DEMO_PRODUCTS: FinancialProduct[] = [
  { id: 'p1', tenant_id: TENANT, name: 'Gestão Tráfego Meta',   default_price: 2500, cost_price:  900, active: true, created_at: '' },
  { id: 'p2', tenant_id: TENANT, name: 'Setup de CRM',          default_price: 1800, cost_price:  400, active: true, created_at: '' },
  { id: 'p3', tenant_id: TENANT, name: 'Pacote de Criativos',   default_price:  950, cost_price:  300, active: true, created_at: '' },
  { id: 'p4', tenant_id: TENANT, name: 'Consultoria Avulsa',    default_price:  600, cost_price:  120, active: true, created_at: '' },
]

export const DEMO_SUMMARY: FinancialSummary = {
  totalRevenue: 21300, manualRevenue: 8300, autoRevenue: 4000,
  autoRevenueCount: 2, contractRevenue: 9000,
  totalExpenses: 7450, netProfit: 13850, profitMargin: 65,
}

export const DEMO_PREV_SUMMARY: FinancialSummary = {
  totalRevenue: 17600, manualRevenue: 6100, autoRevenue: 3500,
  autoRevenueCount: 2, contractRevenue: 8000,
  totalExpenses: 7900, netProfit: 9700, profitMargin: 55,
}

export const DEMO_FATURAMENTO: FaturamentoReceita = {
  faturamento: 28500, receita: 21300, wonCount: 8,
}

export const DEMO_MRR: MRRSummary = { activeMRR: 9000, activeContracts: 4 }

export function demoMonthlyTrend(months = 12): MonthlyPoint[] {
  const base = [12400, 13800, 11900, 15200, 14100, 16800, 15500, 18200, 17600, 19400, 21300, 22800]
  const exp  = [6900, 7400, 6600, 8100, 7200, 8600, 7800, 8900, 7900, 8400, 7450, 8200]
  const out: MonthlyPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const idx = (months - 1 - i) % base.length
    const revenue = base[idx], expenses = exp[idx]
    out.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
      revenue, expenses, profit: revenue - expenses,
    })
  }
  return out
}

export const DEMO_CATEGORY_BREAKDOWN: CategoryBreakdown[] = [
  { category: 'Gestão de Tráfego', revenue: 12000, expenses: 0 },
  { category: 'Consultoria',        revenue: 5400,  expenses: 0 },
  { category: 'Criativos',          revenue: 3900,  expenses: 0 },
  { category: 'Anúncios',           revenue: 0,     expenses: 3800 },
  { category: 'Equipe',             revenue: 0,     expenses: 2600 },
  { category: 'Software',           revenue: 0,     expenses: 1050 },
]

export function demoCashFlow(days: number): CashFlowForecast {
  const dailyFixed = 7450 / 30
  const incomeDays = [3, 10, 13, 20, 28, 40, 43, 55, 70, 73, 85]
  let cumulative = 0, confirmedIncome = 0
  const timeline = []
  for (let d = 0; d <= days; d++) {
    const income = incomeDays.includes(d) ? 2500 : 0
    confirmedIncome += income
    cumulative += income - dailyFixed
    if (d % 7 === 0 || d === days) {
      const day = new Date(); day.setDate(day.getDate() + d)
      timeline.push({
        date: daysFromNow(d),
        label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''),
        cumulative: Math.round(cumulative),
      })
    }
  }
  const confirmedExpenses = Math.round(dailyFixed * days)
  return {
    confirmedIncome: Math.round(confirmedIncome),
    confirmedExpenses,
    projectedBalance: Math.round(confirmedIncome - confirmedExpenses),
    timeline,
  }
}

const DEMO_RECORDS: FinancialRecord[] = [
  { id: 'contract-d1-0', tenant_id: TENANT, type: 'revenue', category: 'Contrato', description: 'Parcela de contrato: Ana Costa',      amount: 2500, date: daysFromNow(-4),  lead_id: 'l1', created_by: null, created_at: daysFromNow(-4),  lead_name: 'Ana Costa' },
  { id: 'r2',            tenant_id: TENANT, type: 'revenue', category: 'Criativos',  description: 'Adicional: Pacote de Criativos',     amount:  950, date: daysFromNow(-6),  lead_id: 'l3', created_by: null, created_at: daysFromNow(-6),  lead_name: 'Fernanda Lima' },
  { id: 'r3',            tenant_id: TENANT, type: 'expense', category: 'Anúncios',   description: 'Verba Meta Ads — agosto',            amount: 3800, date: daysFromNow(-8),  lead_id: null, created_by: null, created_at: daysFromNow(-8),  lead_name: null, expense_nature: 'variable' },
  { id: 'contract-d2-0', tenant_id: TENANT, type: 'revenue', category: 'Contrato',   description: 'Parcela de contrato: Roberto Souza', amount: 1800, date: daysFromNow(-11), lead_id: 'l4', created_by: null, created_at: daysFromNow(-11), lead_name: 'Roberto Souza' },
  { id: 'r5',            tenant_id: TENANT, type: 'expense', category: 'Equipe',     description: 'Freelas de design',                  amount: 2600, date: daysFromNow(-14), lead_id: null, created_by: null, created_at: daysFromNow(-14), lead_name: null, expense_nature: 'fixed' },
  { id: 'lead-l5',       tenant_id: TENANT, type: 'revenue', category: 'Lead convertido', description: 'Conversão automática: Juliana Ramos', amount: 4000, date: daysFromNow(-16), lead_id: 'l5', created_by: null, created_at: daysFromNow(-16), lead_name: 'Juliana Ramos' },
  { id: 'r7',            tenant_id: TENANT, type: 'expense', category: 'Software',   description: 'Ferramentas (CRM, design, e-mail)',  amount: 1050, date: daysFromNow(-20), lead_id: null, created_by: null, created_at: daysFromNow(-20), lead_name: null, expense_nature: 'fixed' },
  { id: 'r8',            tenant_id: TENANT, type: 'revenue', category: 'Consultoria', description: 'Consultoria avulsa',                amount: 1200, date: daysFromNow(-24), lead_id: 'l2', created_by: null, created_at: daysFromNow(-24), lead_name: 'Carlos Mendes' },
]

export function demoTransactions(page = 1, pageSize = 25, type?: string): PaginatedTransactions {
  const filtered = type ? DEMO_RECORDS.filter((r) => r.type === type) : DEMO_RECORDS
  const from = (page - 1) * pageSize
  return {
    data: filtered.slice(from, from + pageSize),
    count: filtered.length,
    page, pageSize,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  }
}
