import { supabase } from '@/lib/supabase'
import {
  expandAccruedInstallments, toLocalDateString, todayLocal, addMonthsClamped,
  type AccrualContract, type AccruedInstallment,
} from '@/services/contractAccrual'
import type { RecordType } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ExpenseNature = 'fixed' | 'variable' | 'one_time'

export interface FinancialRecord {
  id:             string
  tenant_id:      string
  type:           RecordType
  category:       string | null
  description:    string | null
  amount:         number
  date:           string
  lead_id:        string | null
  created_by:     string | null
  created_at:     string
  lead_name?:     string | null
  expense_nature?: ExpenseNature | null
  product_id?:    string | null
}

export interface FinancialSummary {
  totalRevenue:    number  // manual + auto (leads) + contrato (parcelas vencidas)
  manualRevenue:   number  // só lançamentos manuais
  autoRevenue:     number  // só de leads convertidos com valor (sem contrato/lançamento)
  autoRevenueCount: number // quantos leads convertidos contam
  contractRevenue: number  // parcelas de contrato já vencidas, sem precisar confirmar nada
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
  type:            RecordType
  category?:       string
  description?:    string
  amount:          number
  date:            string
  lead_id?:        string
  expense_nature?: ExpenseNature
  product_id?:     string
}

// ── Leads com contrato/lançamentos detalhados ────────────────────────────────
// Esses leads têm a receita real rastreada via financial_records (contrato +
// produtos), então leads.value não deve ser somado de novo como "auto-receita"
// — senão duplica (uma vez em manualRevenue, outra em autoRevenue).

async function fetchLeadIdsWithDetailedFinancials(tenantId: string): Promise<Set<string>> {
  const [contractsRes, recordsRes] = await Promise.all([
    supabase.from('client_contracts').select('lead_id').eq('tenant_id', tenantId).neq('status', 'cancelled'),
    supabase.from('financial_records').select('lead_id').eq('tenant_id', tenantId).not('lead_id', 'is', null),
  ])
  const ids = new Set<string>()
  for (const row of contractsRes.data ?? []) ids.add(row.lead_id)
  for (const row of recordsRes.data ?? [])   if (row.lead_id) ids.add(row.lead_id)
  return ids
}

// ── Receita de contrato — parcelas já vencidas, sem precisar confirmar nada ──
// Cada mês que chega já conta como recebido, contanto que o contrato não
// tenha sido cancelado. Pausar/cancelar congela no que já venceu até ali.

async function fetchAllAccruedInstallments(tenantId: string): Promise<AccruedInstallment[]> {
  const { data, error } = await supabase
    .from('client_contracts')
    .select('billing_type, amount, installments, start_date, status, updated_at')
    .eq('tenant_id', tenantId)

  if (error) throw error

  const out: AccruedInstallment[] = []
  for (const c of data ?? []) {
    const contract: AccrualContract = {
      billing_type: c.billing_type,
      amount:       Number(c.amount),
      installments: c.installments,
      start_date:   c.start_date,
      status:       c.status,
      updated_at:   c.updated_at,
    }
    for (const inst of expandAccruedInstallments(contract)) out.push(inst)
  }
  return out
}

async function fetchContractInstallmentsInRange(
  tenantId:  string,
  dateFrom?: string,
  dateTo?:   string,
): Promise<number> {
  const installments = await fetchAllAccruedInstallments(tenantId)
  // Sem dateTo explícito (consulta "vitalícia"): não inclui parcelas futuras
  // ainda não vencidas. Com dateTo explícito (ex: navegando pra "setembro"),
  // respeita o período pedido mesmo que seja no futuro.
  const effectiveDateTo = dateTo ?? todayLocal()
  let total = 0
  for (const inst of installments) {
    if (dateFrom && inst.date < dateFrom) continue
    if (inst.date > effectiveDateTo) continue
    total += inst.amount
  }
  return total
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

  // 2. Receita automática (leads convertidos com valor, SEM contrato/lançamentos
  //    detalhados — esses já entram via manualRevenue e não devem duplicar)
  let autoQuery = supabase
    .from('leads')
    .select('id, value, updated_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'converted')
    .not('value', 'is', null)

  if (dateFrom) autoQuery = autoQuery.gte('updated_at', dateFrom)
  if (dateTo)   autoQuery = autoQuery.lte('updated_at', dateTo + 'T23:59:59')

  const [manualRes, autoRes, detailedIds, contractRevenue] = await Promise.all([
    manualQuery, autoQuery, fetchLeadIdsWithDetailedFinancials(tenantId),
    fetchContractInstallmentsInRange(tenantId, dateFrom, dateTo),
  ])
  if (manualRes.error) throw manualRes.error
  if (autoRes.error)   throw autoRes.error

  // Soma manuais
  let manualRevenue = 0
  let totalExpenses = 0
  for (const row of manualRes.data ?? []) {
    if (row.type === 'revenue') manualRevenue  += Number(row.amount)
    else                        totalExpenses  += Number(row.amount)
  }

  // Soma auto-receitas dos leads convertidos (exclui os com rastreio detalhado —
  // esses já entram via contractRevenue ou manualRevenue)
  let autoRevenue       = 0
  let autoRevenueCount  = 0
  for (const row of autoRes.data ?? []) {
    if (row.value != null && !detailedIds.has(row.id)) {
      autoRevenue += Number(row.value)
      autoRevenueCount++
    }
  }

  const totalRevenue = manualRevenue + autoRevenue + contractRevenue
  const netProfit    = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0
    ? Math.round((netProfit / totalRevenue) * 100)
    : 0

  return {
    totalRevenue, manualRevenue, autoRevenue, autoRevenueCount, contractRevenue,
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
  const fromDate = toLocalDateString(cutoff)

  // Busca manuais E leads convertidos em paralelo
  const [manualRes, leadsRes, detailedIds, contractInstallments] = await Promise.all([
    supabase.from('financial_records')
      .select('type, amount, date')
      .eq('tenant_id', tenantId)
      .gte('date', fromDate),
    supabase.from('leads')
      .select('id, value, updated_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'converted')
      .not('value', 'is', null)
      .gte('updated_at', fromDate),
    fetchLeadIdsWithDetailedFinancials(tenantId),
    fetchAllAccruedInstallments(tenantId),
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

  // Soma leads convertidos como receita (exclui os com rastreio detalhado —
  // contrato/produtos já entram via manualRevenue ou parcelas de contrato)
  for (const row of leadsRes.data ?? []) {
    if (detailedIds.has(row.id)) continue
    const key = row.updated_at.slice(0, 7)
    if (!map.has(key)) continue
    const entry = map.get(key)!
    entry.revenue += Number(row.value ?? 0)
  }

  // Soma parcelas de contrato já vencidas, no mês em que venceram
  for (const inst of contractInstallments) {
    const key = inst.date.slice(0, 7)
    if (!map.has(key)) continue
    map.get(key)!.revenue += inst.amount
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

  // 3. Parcelas de contrato já vencidas (contam como receita automática também)
  const contractsQuery = supabase
    .from('client_contracts')
    .select('id, billing_type, amount, installments, start_date, status, updated_at, leads ( id, name )')
    .eq('tenant_id', tenantId)

  const [manualRes, leadsRes, detailedIds, contractsRes] = await Promise.all([
    manualQuery, leadsQuery, fetchLeadIdsWithDetailedFinancials(tenantId), contractsQuery,
  ])
  if (manualRes.error)    throw manualRes.error
  if (leadsRes.error)     throw leadsRes.error
  if (contractsRes.error) throw contractsRes.error

  // Mapeia manuais
  const manualRows: FinancialRecord[] = (manualRes.data ?? []).map((row) => ({
    id:             row.id,
    tenant_id:      row.tenant_id,
    type:           row.type as RecordType,
    category:       row.category,
    description:    row.description,
    amount:         Number(row.amount),
    date:           row.date,
    lead_id:        row.lead_id,
    created_by:     row.created_by,
    created_at:     row.created_at,
    lead_name:      (row.leads as unknown as { name: string } | null)?.name ?? null,
    expense_nature: row.expense_nature as ExpenseNature | null,
    product_id:     row.product_id,
  }))

  // Mapeia leads convertidos como receita auto (se filtro de tipo for revenue ou vazio;
  // exclui os com contrato/produtos — esses já aparecem como lançamentos manuais reais)
  let autoRows: FinancialRecord[] = []
  if (!type || type === 'revenue') {
    autoRows = (leadsRes.data ?? [])
      .filter((l) => !detailedIds.has(l.id))
      .map((l) => ({
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

  // Mapeia parcelas de contrato já vencidas como receita automática (se filtro
  // de tipo for revenue ou vazio) — mostra cada parcela vencida como uma linha,
  // filtrada pelo período pedido
  const contractRows: FinancialRecord[] = []
  if (!type || type === 'revenue') {
    for (const row of contractsRes.data ?? []) {
      const lead = row.leads as unknown as { id: string; name: string } | null
      if (!lead) continue
      const contract: AccrualContract = {
        billing_type: row.billing_type,
        amount:       Number(row.amount),
        installments: row.installments,
        start_date:   row.start_date,
        status:       row.status,
        updated_at:   row.updated_at,
      }
      // Sem dateTo explícito na lista, não mostra parcelas futuras ainda não
      // vencidas; com dateTo explícito (período escolhido no filtro), respeita.
      const effectiveDateTo = dateTo ?? todayLocal()
      const installments = expandAccruedInstallments(contract)
        .filter((inst) => (!dateFrom || inst.date >= dateFrom) && inst.date <= effectiveDateTo)

      installments.forEach((inst, idx) => {
        contractRows.push({
          id:          `contract-${row.id}-${idx}`,
          tenant_id:   tenantId,
          type:        'revenue',
          category:    'Contrato',
          description: `Parcela de contrato: ${lead.name}`,
          amount:      inst.amount,
          date:        inst.date,
          lead_id:     lead.id,
          created_by:  null,
          created_at:  inst.date,
          lead_name:   lead.name,
        })
      })
    }
  }

  // Combina, ordena por data desc e pagina manualmente
  const combined = [...manualRows, ...autoRows, ...contractRows].sort((a, b) =>
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
      tenant_id:      tenantId,
      created_by:     createdBy,
      type:           data.type,
      category:       data.category ?? null,
      description:    data.description ?? null,
      amount:         data.amount,
      date:           data.date,
      lead_id:        data.lead_id ?? null,
      expense_nature: data.expense_nature ?? null,
      product_id:     data.product_id ?? null,
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

// ── Histórico de compras de um cliente (lead) ────────────────────────────────

export interface LeadPurchase {
  id:           string
  date:         string
  amount:       number
  description:  string | null
  category:     string | null
  product_name: string | null
}

// ── Breakdown por categoria ───────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string
  revenue:  number
  expenses: number
}

export async function fetchCategoryBreakdown(
  tenantId:  string,
  dateFrom?: string,
  dateTo?:   string,
): Promise<CategoryBreakdown[]> {
  let query = supabase
    .from('financial_records')
    .select('type, category, amount')
    .eq('tenant_id', tenantId)

  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo)   query = query.lte('date', dateTo)

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, { revenue: number; expenses: number }>()
  for (const row of data ?? []) {
    const key = row.category ?? 'Sem categoria'
    if (!map.has(key)) map.set(key, { revenue: 0, expenses: 0 })
    const entry = map.get(key)!
    if (row.type === 'revenue') entry.revenue  += Number(row.amount)
    else                        entry.expenses += Number(row.amount)
  }

  return Array.from(map.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => (b.revenue + b.expenses) - (a.revenue + a.expenses))
}

// ── Previsão de fluxo de caixa ────────────────────────────────────────────────
// Baseada em: (1) parcelas futuras de contratos recorrentes ativos e
// (2) a última despesa marcada como "fixa" por categoria, projetada pra frente.
// Não tenta advinhar receita/despesa variável — só o que já é compromisso conhecido.

export interface CashFlowPoint {
  date:       string
  label:      string
  cumulative: number
}

export interface CashFlowForecast {
  confirmedIncome:   number
  confirmedExpenses: number
  projectedBalance:  number
  timeline:          CashFlowPoint[]
}

export async function fetchCashFlowForecast(tenantId: string, days: number): Promise<CashFlowForecast> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [contractsRes, fixedRes] = await Promise.all([
    supabase
      .from('client_contracts')
      .select('amount, installments, start_date')
      .eq('tenant_id', tenantId)
      .eq('billing_type', 'recurring')
      .eq('status', 'active'),
    supabase
      .from('financial_records')
      .select('category, amount, date')
      .eq('tenant_id', tenantId)
      .eq('type', 'expense')
      .eq('expense_nature', 'fixed')
      .gte('date', toLocalDateString(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())))
      .order('date', { ascending: false }),
  ])

  if (contractsRes.error) throw contractsRes.error
  if (fixedRes.error)     throw fixedRes.error

  // Custo fixo mensal = última despesa "fixa" lançada por categoria
  const latestByCategory = new Map<string, number>()
  for (const row of fixedRes.data ?? []) {
    const key = row.category ?? '—'
    if (!latestByCategory.has(key)) latestByCategory.set(key, Number(row.amount))
  }
  const monthlyFixedCost = Array.from(latestByCategory.values()).reduce((a, b) => a + b, 0)
  const dailyFixedCost   = monthlyFixedCost / 30

  // Mapeia as datas de vencimento das parcelas dos contratos ativos. Parcelas
  // já vencidas (ex: contrato começou há alguns dias) não são descartadas —
  // ainda são um valor confirmado do cliente, só que já devido "hoje".
  // Contrato SEM prazo (installments null) projeta pelo horizonte pedido.
  const horizonMonths = Math.ceil(days / 30) + 2
  const incomeByDay = new Map<string, number>()
  for (const c of contractsRes.data ?? []) {
    const start = new Date(c.start_date + 'T00:00:00')
    const count = c.installments ?? horizonMonths
    for (let i = 0; i < count; i++) {
      const due = addMonthsClamped(start, i)
      const dueClamped = due < today ? today : due
      const dueStr = toLocalDateString(dueClamped)
      incomeByDay.set(dueStr, (incomeByDay.get(dueStr) ?? 0) + Number(c.amount))
    }
  }

  let cumulative       = 0
  let confirmedIncome  = 0
  const timeline: CashFlowPoint[] = []

  for (let d = 0; d <= days; d++) {
    const day = new Date(today)
    day.setDate(day.getDate() + d)
    const dayStr = toLocalDateString(day)

    const dayIncome = incomeByDay.get(dayStr) ?? 0
    confirmedIncome += dayIncome
    cumulative += dayIncome - dailyFixedCost

    if (d % 7 === 0 || d === days) {
      timeline.push({
        date:  dayStr,
        label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''),
        cumulative: Math.round(cumulative),
      })
    }
  }

  const confirmedExpenses = Math.round(dailyFixedCost * days)

  return {
    confirmedIncome:   Math.round(confirmedIncome),
    confirmedExpenses,
    projectedBalance:  Math.round(confirmedIncome - confirmedExpenses),
    timeline,
  }
}

export async function fetchLeadPurchases(leadId: string): Promise<LeadPurchase[]> {
  const { data, error } = await supabase
    .from('financial_records')
    .select('id, date, amount, description, category, financial_products ( name )')
    .eq('lead_id', leadId)
    .eq('type', 'revenue')
    .order('date', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id:           row.id,
    date:         row.date,
    amount:       Number(row.amount),
    description:  row.description,
    category:     row.category,
    product_name: (row.financial_products as unknown as { name: string } | null)?.name ?? null,
  }))
}
