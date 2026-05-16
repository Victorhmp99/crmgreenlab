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
  totalRevenue:    number  // manual + auto (leads)
  manualRevenue:   number  // só lançamentos manuais
  autoRevenue:     number  // só de leads convertidos com valor
  autoRevenueCount: number // quantos leads convertidos contam
  totalExpenses:   number
  netProfit:       number
  profitMargin:    number  // % (0-100)
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
  // 1. Receitas/despesas manuais (financial_records)
  let manualQuery = supabase
    .from('financial_records')
    .select('type, amount')
    .eq('tenant_id', tenantId)

  if (dateFrom) manualQuery = manualQuery.gte('date', dateFrom)
  if (dateTo)   manualQuery = manualQuery.lte('date', dateTo)

  // 2. Receita automática (leads convertidos com valor)
  let autoQuery = supabase
    .from('leads')
    .select('value, updated_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'converted')
    .not('value', 'is', null)

  if (dateFrom) autoQuery = autoQuery.gte('updated_at', dateFrom)
  if (dateTo)   autoQuery = autoQuery.lte('updated_at', dateTo + 'T23:59:59')

  const [manualRes, autoRes] = await Promise.all([manualQuery, autoQuery])
  if (manualRes.error) throw manualRes.error
  if (autoRes.error)   throw autoRes.error

  // Soma manuais
  let manualRevenue = 0
  let totalExpenses = 0
  for (const row of manualRes.data ?? []) {
    if (row.type === 'revenue') manualRevenue  += Number(row.amount)
    else                        totalExpenses  += Number(row.amount)
  }

  // Soma auto-receitas dos leads convertidos
  let autoRevenue       = 0
  let autoRevenueCount  = 0
  for (const row of autoRes.data ?? []) {
    if (row.value != null) {
      autoRevenue += Number(row.value)
      autoRevenueCount++
    }
  }

  const totalRevenue = manualRevenue + autoRevenue
  const netProfit    = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0
    ? Math.round((netProfit / totalRevenue) * 100)
    : 0

  return {
    totalRevenue, manualRevenue, autoRevenue, autoRevenueCount,
    totalExpenses, netProfit, profitMargin,
  }
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

  // Busca manuais E leads convertidos em paralelo
  const [manualRes, leadsRes] = await Promise.all([
    supabase.from('financial_records')
      .select('type, amount, date')
      .eq('tenant_id', tenantId)
      .gte('date', fromDate),
    supabase.from('leads')
      .select('value, updated_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'converted')
      .not('value', 'is', null)
      .gte('updated_at', fromDate),
  ])

  if (manualRes.error) throw manualRes.error
  if (leadsRes.error)  throw leadsRes.error

  // Inicializa todos os meses com 0
  const map = new Map<string, { revenue: number; expenses: number }>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    map.set(d.toISOString().slice(0, 7), { revenue: 0, expenses: 0 })
  }

  // Soma manuais
  for (const row of manualRes.data ?? []) {
    const key = row.date.slice(0, 7)
    if (!map.has(key)) continue
    const entry = map.get(key)!
    if (row.type === 'revenue') entry.revenue  += Number(row.amount)
    else                        entry.expenses += Number(row.amount)
  }

  // Soma leads convertidos como receita
  for (const row of leadsRes.data ?? []) {
    const key = row.updated_at.slice(0, 7)
    if (!map.has(key)) continue
    const entry = map.get(key)!
    entry.revenue += Number(row.value ?? 0)
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

  // 1. Lançamentos manuais (todos, sem paginação ainda — vamos combinar com leads e paginar no fim)
  let manualQuery = supabase
    .from('financial_records')
    .select(`*, leads ( name )`)
    .eq('tenant_id', tenantId)

  if (type)     manualQuery = manualQuery.eq('type', type)
  if (dateFrom) manualQuery = manualQuery.gte('date', dateFrom)
  if (dateTo)   manualQuery = manualQuery.lte('date', dateTo)

  // 2. Leads convertidos com valor (entradas automáticas)
  let leadsQuery = supabase
    .from('leads')
    .select('id, name, value, updated_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'converted')
    .not('value', 'is', null)

  if (dateFrom) leadsQuery = leadsQuery.gte('updated_at', dateFrom)
  if (dateTo)   leadsQuery = leadsQuery.lte('updated_at', dateTo + 'T23:59:59')

  const [manualRes, leadsRes] = await Promise.all([manualQuery, leadsQuery])
  if (manualRes.error) throw manualRes.error
  if (leadsRes.error)  throw leadsRes.error

  // Mapeia manuais
  const manualRows: FinancialRecord[] = (manualRes.data ?? []).map((row) => ({
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

  // Mapeia leads convertidos como receita auto (se filtro de tipo for revenue ou vazio)
  let autoRows: FinancialRecord[] = []
  if (!type || type === 'revenue') {
    autoRows = (leadsRes.data ?? []).map((l) => ({
      id:          'lead-' + l.id,
      tenant_id:   tenantId,
      type:        'revenue' as RecordType,
      category:    'Lead convertido',
      description: `Conversão automática: ${l.name}`,
      amount:      Number(l.value ?? 0),
      date:        (l.updated_at as string).slice(0, 10),
      lead_id:     l.id,
      created_by:  null,
      created_at:  l.updated_at as string,
      lead_name:   l.name,
    }))
  }

  // Combina, ordena por data desc e pagina manualmente
  const combined = [...manualRows, ...autoRows].sort((a, b) =>
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  )

  const total = combined.length
  const fromIdx = (page - 1) * pageSize
  const sliced = combined.slice(fromIdx, fromIdx + pageSize)

  return {
    data: sliced,
    count: total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
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
