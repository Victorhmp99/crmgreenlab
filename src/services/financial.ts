import { supabase } from '@/lib/supabase'
import type { RecordType } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FinancialRecord {
  id:          string
  tenant_id:   string
  type:        RecordType
  category:    string | null
  description: string | null
  amount:      number
  date:        string
  lead_id:     string | null
  created_by:  string | null
  created_at:  string
  lead_name?:  string | null
}

export interface FinancialSummary {
  totalRevenue:  number
  totalExpenses: number
  netProfit:     number
  profitMargin:  number   // % (0-100)
}

export interface MonthlyPoint {
  month:    string   // "2026-01"
  label:    string   // "Jan/26"
  revenue:  number
  expenses: number
  profit:   number
}

export interface FinancialFilters {
  type?:      RecordType | ''
  category?:  string
  dateFrom?:  string
  dateTo?:    string
  page?:      number
  pageSize?:  number
}

export interface PaginatedTransactions {
  data:       FinancialRecord[]
  count:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export interface CreateTransactionData {
  type:        RecordType
  category?:   string
  description?: string
  amount:      number
  date:        string
  lead_id?:    string
}

// ── Resumo financeiro para um período ────────────────────────────────────────

export async function fetchFinancialSummary(
  tenantId:  string,
  dateFrom?: string,
  dateTo?:   string,
): Promise<FinancialSummary> {
  let query = supabase
    .from('financial_records')
    .select('type, amount')
    .eq('tenant_id', tenantId)

  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo)   query = query.lte('date', dateTo)

  const { data, error } = await query
  if (error) throw error

  let totalRevenue  = 0
  let totalExpenses = 0

  for (const row of data ?? []) {
    if (row.type === 'revenue') totalRevenue  += Number(row.amount)
    else                        totalExpenses += Number(row.amount)
  }

  const netProfit    = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0
    ? Math.round((netProfit / totalRevenue) * 100)
    : 0

  return { totalRevenue, totalExpenses, netProfit, profitMargin }
}

// ── Tendência mensal (últimos N meses) ────────────────────────────────────────

export async function fetchMonthlyTrend(
  tenantId: string,
  months = 12,
): Promise<MonthlyPoint[]> {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months + 1)
  cutoff.setDate(1)
  const fromDate = cutoff.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('financial_records')
    .select('type, amount, date')
    .eq('tenant_id', tenantId)
    .gte('date', fromDate)

  if (error) throw error

  // Agrupa por mês
  const map = new Map<string, { revenue: number; expenses: number }>()

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    map.set(key, { revenue: 0, expenses: 0 })
  }

  for (const row of data ?? []) {
    const key = row.date.slice(0, 7)
    if (!map.has(key)) continue
    const entry = map.get(key)!
    if (row.type === 'revenue') entry.revenue  += Number(row.amount)
    else                        entry.expenses += Number(row.amount)
  }

  return Array.from(map.entries()).map(([month, { revenue, expenses }]) => {
    const [year, m] = month.split('-')
    const label = new Date(Number(year), Number(m) - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('.', '')
    return { month, label, revenue, expenses, profit: revenue - expenses }
  })
}

// ── Listagem paginada de transações ──────────────────────────────────────────

export async function fetchTransactions(
  tenantId: string,
  filters: FinancialFilters = {},
): Promise<PaginatedTransactions> {
  const { type, dateFrom, dateTo, page = 1, pageSize = 25 } = filters
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from('financial_records')
    .select(`*, leads ( name )`, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (type)     query = query.eq('type', type)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo)   query = query.lte('date', dateTo)

  const { data, error, count } = await query
  if (error) throw error

  const rows: FinancialRecord[] = (data ?? []).map((row) => ({
    id:          row.id,
    tenant_id:   row.tenant_id,
    type:        row.type as RecordType,
    category:    row.category,
    description: row.description,
    amount:      Number(row.amount),
    date:        row.date,
    lead_id:     row.lead_id,
    created_by:  row.created_by,
    created_at:  row.created_at,
    lead_name:   (row.leads as unknown as { name: string } | null)?.name ?? null,
  }))

  return {
    data: rows,
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createTransaction(
  tenantId:  string,
  createdBy: string,
  data:      CreateTransactionData,
): Promise<FinancialRecord> {
  const { data: created, error } = await supabase
    .from('financial_records')
    .insert({
      tenant_id:   tenantId,
      created_by:  createdBy,
      type:        data.type,
      category:    data.category ?? null,
      description: data.description ?? null,
      amount:      data.amount,
      date:        data.date,
      lead_id:     data.lead_id ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return { ...created, amount: Number(created.amount), lead_name: null }
}

export async function updateTransaction(
  id:   string,
  data: Partial<CreateTransactionData>,
): Promise<void> {
  const { error } = await supabase.from('financial_records').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('financial_records').delete().eq('id', id)
  if (error) throw error
}

// Categorias sugeridas por tipo
export const REVENUE_CATEGORIES = [
  'Consulta', 'Tratamento', 'Cirurgia', 'Ortodontia', 'Implante',
  'Clareamento', 'Prótese', 'Outros',
]
export const EXPENSE_CATEGORIES = [
  'Aluguel', 'Equipamento', 'Material', 'Salário', 'Marketing',
  'Software', 'Manutenção', 'Impostos', 'Outros',
]
