import { supabase } from '@/lib/supabase'
import { fetchFunnelSteps } from './funnelSteps'
import type { FunnelStep } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SellerPerformance {
  userId:      string
  email:       string
  fullName:    string | null
  leads:       number
  wonCount:    number
  lostCount:   number
  revenue:     number
  forecast:    number
  loss:        number
  avgTicket:   number
  convRate:    number   // % conversão = won / (won + lost)
}

export interface FunnelStageData {
  stageId:    string
  stageName:  string
  color:      string
  stageType:  string
  count:      number
  totalValue: number
  pct:        number   // % do total de leads no pipeline
}

export interface CampaignPerformance {
  campaign:      string   // source_campaign ou source
  leads:         number
  conversions:   number
  convRate:      number
}

export interface LeadSourceBreakdown {
  source:      string
  leads:       number
  conversions: number
  convRate:    number
}

export interface ChannelBreakdown {
  channelId:    string | null
  channelName:  string
  color:        string
  leads:        number
  contatosFeitos: number  // alimentado pela mesma lógica do funil (passo "Contato feito")
  reunioes:     number    // alimentado pelo passo "Reunião"/"Em negociação"
  conversions:  number    // status='converted'
  declined:     number    // status='lost'
  meetingRate:  number    // % reuniões / leads
  convRate:     number    // % conversões / leads
}

// Performance agrupada por PIPELINE (cada linha = 1 pipeline do tenant)
// Cada coluna representa uma fase do FUNIL (configurada via funnel_steps).
// As taxas são calculadas entre fases adjacentes.
export interface PipelineBreakdown {
  pipelineId:    string
  pipelineName:  string
  color:         string
  leads:         number  // total de cards na pipeline
  contatosFeitos: number // leads que passaram por "Contato feito"
  reunioes:      number  // leads que passaram por "Reunião agendada"
  negociacao:    number  // leads que passaram por "Em negociação"
  conversions:   number  // leads em estado "Fechado" (status=converted)
  declined:      number  // leads com status='lost'
  // Taxas entre fases (% de avanço de uma pra próxima)
  txMarcacaoReuniao:   number  // (reunioes / contatos)  · marcação
  txComparecimento:    number  // (negociacao / reunioes) · comparecimento
  txConversao:         number  // (conversions / negociacao) · conversão
}

export interface ConversionFunnelMetrics {
  totalLeads:    number
  meetingsCount: number
  convertedCount: number
  declinedCount: number
  meetingRate:   number
  convRate:      number
  declineRate:   number
}

// ── Performance por vendedor ──────────────────────────────────────────────────

export async function fetchSellerPerformance(
  tenantId:  string,
  startDate: string,
  endDate:   string,
): Promise<SellerPerformance[]> {
  // Usa RPC SECURITY DEFINER que traz tudo agrupado por vendedor
  const { data, error } = await supabase.rpc('get_seller_financial_metrics', {
    p_tenant_id: tenantId,
    p_from:      startDate,
    p_to:        endDate,
  })

  if (error) throw error

  return ((data ?? []) as Array<{
    user_id: string; email: string; full_name: string | null;
    total_leads: number; won_count: number; lost_count: number;
    revenue: number; forecast: number; loss: number;
    avg_ticket: number; conv_rate: number;
  }>).map((row) => ({
    userId:    row.user_id,
    email:     row.email ?? '—',
    fullName:  row.full_name,
    leads:     row.total_leads,
    wonCount:  row.won_count,
    lostCount: row.lost_count,
    revenue:   Number(row.revenue),
    forecast:  Number(row.forecast),
    loss:      Number(row.loss),
    avgTicket: Number(row.avg_ticket),
    convRate:  row.conv_rate,
  }))
}

// ── Distribuição do funil por etapa ──────────────────────────────────────────

export async function fetchFunnelBreakdown(tenantId: string): Promise<FunnelStageData[]> {
  // Usa MESMA LÓGICA do funil principal (fetchFunnelTotals).
  // Cada barra = um passo do funil, com contagem agregada da categoria.
  const [steps, totals] = await Promise.all([
    fetchFunnelSteps(tenantId),
    fetchFunnelTotals(tenantId),
  ])

  // Calcula valor R$ por categoria (soma dos leads.value cuja stage atual pertence à categoria)
  // Mantém o valor por etapa pra mostrar no tooltip
  const { data: cardsValueData } = await supabase
    .from('pipeline_cards')
    .select('lead_id, stage_id, pipeline_stages(name, stage_type), leads(value)')
    .eq('tenant_id', tenantId)

  type CardRow = {
    lead_id: string
    stage_id: string
    pipeline_stages: { name: string; stage_type: string | null } | { name: string; stage_type: string | null }[] | null
    leads: { value: number | null } | { value: number | null }[] | null
  }

  const valueByCat: Record<string, number> = { contato: 0, reuniao: 0, negociacao: 0, fechado: 0, other: 0 }
  // Pra dedupe de valor por lead+categoria
  const valueSeen = new Map<string, Set<string>>()
  for (const c of (cardsValueData ?? []) as CardRow[]) {
    const stage = Array.isArray(c.pipeline_stages) ? c.pipeline_stages[0] : c.pipeline_stages
    const lead  = Array.isArray(c.leads) ? c.leads[0] : c.leads
    if (!stage || !lead) continue
    const cat = classifyStageName(stage.name, stage.stage_type)
    const v = Number(lead.value ?? 0)
    if (v <= 0) continue
    let seen = valueSeen.get(cat); if (!seen) { seen = new Set(); valueSeen.set(cat, seen) }
    if (!seen.has(c.lead_id)) {
      seen.add(c.lead_id)
      valueByCat[cat] = (valueByCat[cat] ?? 0) + v
    }
  }

  const catOf = (name: string): 'contato' | 'reuniao' | 'negociacao' | 'fechado' | 'other' => {
    const n = name.toLowerCase()
    if (/fechad|ganho|won|convertido|contrato/.test(n)) return 'fechado'
    if (/negoci|propost|or[çc]ament/.test(n))            return 'negociacao'
    if (/reuni|agenda|meeting/.test(n))                  return 'reuniao'
    if (/contato|primeiro|inicial|abord/.test(n))        return 'contato'
    return 'other'
  }

  const total = totals.totalLeads
  return steps.map((s: FunnelStep) => {
    const cat = catOf(s.name)
    const count =
      cat === 'contato'    ? totals.contato :
      cat === 'reuniao'    ? totals.reuniao :
      cat === 'negociacao' ? totals.negociacao :
      cat === 'fechado'    ? totals.fechado :
      total  // primeiro passo (Leads Captados) = todos
    const stageType =
      cat === 'fechado' ? 'won' :
      cat === 'other'   ? 'in_progress' :
      'in_progress'
    return {
      stageId:    s.id,
      stageName:  s.name,
      color:      s.color,
      stageType,
      count,
      totalValue: valueByCat[cat] ?? 0,
      pct:        total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })
}

// ── Performance por campanha de origem ───────────────────────────────────────

export async function fetchCampaignPerformance(tenantId: string): Promise<CampaignPerformance[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('source_campaign, source, status')
    .eq('tenant_id', tenantId)
    .not('source_campaign', 'is', null)

  if (error) throw error

  const map = new Map<string, { leads: number; conversions: number }>()

  for (const row of data ?? []) {
    const key = row.source_campaign ?? row.source
    if (!map.has(key)) map.set(key, { leads: 0, conversions: 0 })
    const entry = map.get(key)!
    entry.leads++
    if (row.status === 'converted') entry.conversions++
  }

  return Array.from(map.entries())
    .map(([campaign, { leads, conversions }]) => ({
      campaign,
      leads,
      conversions,
      convRate: leads > 0 ? Math.round((conversions / leads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 20)
}

// ── Distribuição por origem (source) ─────────────────────────────────────────

export async function fetchSourceBreakdown(tenantId: string): Promise<LeadSourceBreakdown[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('source, status')
    .eq('tenant_id', tenantId)

  if (error) throw error

  // Todas as origens possíveis (sempre mostradas, mesmo com 0)
  const ALL_SOURCES = ['manual', 'import', 'meta_ads', 'google', 'referral', 'other'] as const
  const map = new Map<string, { leads: number; conversions: number }>()
  for (const s of ALL_SOURCES) map.set(s, { leads: 0, conversions: 0 })

  for (const row of data ?? []) {
    if (!map.has(row.source)) map.set(row.source, { leads: 0, conversions: 0 })
    const entry = map.get(row.source)!
    entry.leads++
    if (row.status === 'converted') entry.conversions++
  }

  return Array.from(map.entries())
    .map(([source, { leads, conversions }]) => ({
      source,
      leads,
      conversions,
      convRate: leads > 0 ? Math.round((conversions / leads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads)
}

// ── Breakdown por canal (Inbound/Outbound/etc) ───────────────────────────────

// Helpers — cada coluna mapeia para UM passo específico do funil pelo nome:
//   Contatos Feitos  → passo com nome tipo "Contato feito"
//   Reuniões         → passo com nome tipo "Em Negociação" (per regra do usuário)
function isContatoStep(name: string): boolean {
  return /contato|primeiro|inicial|abord/i.test(name)
}
function isNegociacaoStep(name: string): boolean {
  // Inclui "Em Negociação", "Está em Negociação", "Proposta", "Orçamento"
  // e também "Reunião"/"Agendada"/"Marcou Reunião" (usuário equiparou)
  return /negoci|propost|or[çc]ament|reuni|agenda|meeting/i.test(name)
}

// Tipos compartilhados entre fetchFunnelBreakdown e fetchPipelineBreakdown
type FunnelCat = 'contato' | 'reuniao' | 'negociacao' | 'fechado' | 'lost' | 'other'

function classifyStageName(name: string, stageType: string | null): FunnelCat {
  if (stageType === 'won')  return 'fechado'
  if (stageType === 'lost') return 'lost'
  const n = name.toLowerCase()
  if (/fechad|ganho|won|convertido|contrato/.test(n))  return 'fechado'
  if (/perdid|lost|recusad|declin|cancelado/.test(n))  return 'lost'
  if (/negoci|propost|or[çc]ament/.test(n))             return 'negociacao'
  if (/reuni|agenda|meeting/.test(n))                   return 'reuniao'
  if (/contato|primeiro|inicial|abord/.test(n))         return 'contato'
  return 'other'
}

// Categorias do lead com base em DISPAROS + HISTÓRICO + STATUS + STAGE ATUAL.
// Cada categoria é INDEPENDENTE (lead pode ter contato + reunião sem ser cumulativo).
// Retorna por lead: { pipelines em que tem card, cats: Set<FunnelCat> }.
interface LeadCategoryData {
  leadId:    string
  pipelines: Set<string>   // pipeline_ids onde o lead tem card
  cats:      Set<FunnelCat>
}

async function fetchLeadCategorization(tenantId: string): Promise<{
  byLead:     Map<string, LeadCategoryData>
  pipelines:  Array<{ id: string; name: string; color: string; position: number }>
}> {
  const [pipelinesRes, stagesRes, cardsRes, leadsRes, activitiesRes] = await Promise.all([
    supabase.from('pipelines').select('id, name, color, position')
      .eq('tenant_id', tenantId).order('position'),
    supabase.from('pipeline_stages').select('id, name, pipeline_id, stage_type')
      .eq('tenant_id', tenantId),
    supabase.from('pipeline_cards').select('lead_id, stage_id')
      .eq('tenant_id', tenantId),
    supabase.from('leads').select('id, status')
      .eq('tenant_id', tenantId),
    supabase.from('lead_activities').select('lead_id, type, metadata')
      .eq('tenant_id', tenantId),
  ])
  if (pipelinesRes.error || stagesRes.error || cardsRes.error || leadsRes.error || activitiesRes.error) {
    throw pipelinesRes.error ?? stagesRes.error ?? cardsRes.error ?? leadsRes.error ?? activitiesRes.error
  }

  // Mapa stage_id → { pipeline_id, cat, name } + nome→cat por pipeline
  const stageInfo = new Map<string, { pipeline_id: string; cat: FunnelCat; name: string }>()
  const stageNameCatGlobal = new Map<string, FunnelCat>()
  for (const s of (stagesRes.data ?? []) as Array<{
    id: string; name: string; pipeline_id: string | null; stage_type: string | null
  }>) {
    if (!s.pipeline_id) continue
    const cat = classifyStageName(s.name, s.stage_type)
    stageInfo.set(s.id, { pipeline_id: s.pipeline_id, cat, name: s.name })
    stageNameCatGlobal.set(s.name, cat)
  }

  // status do lead
  const leadStatus = new Map<string, string>()
  for (const l of (leadsRes.data ?? []) as Array<{ id: string; status: string }>) {
    leadStatus.set(l.id, l.status)
  }

  // Inicializa byLead com os leads que tem card (filtro de pipeline)
  // IMPORTANTE: 'fechado' e 'lost' NÃO vêm de stages — só do status do lead.
  // Stages "Fechado" só contribuem se o lead também estiver status='converted'.
  const byLead = new Map<string, LeadCategoryData>()
  for (const c of (cardsRes.data ?? []) as Array<{ lead_id: string; stage_id: string }>) {
    const info = stageInfo.get(c.stage_id)
    if (!info) continue
    let entry = byLead.get(c.lead_id)
    if (!entry) {
      entry = { leadId: c.lead_id, pipelines: new Set(), cats: new Set() }
      byLead.set(c.lead_id, entry)
    }
    entry.pipelines.add(info.pipeline_id)
    // Stage atual contribui pra contato/reunião/negociação (não pra fechado/lost)
    if (info.cat === 'contato' || info.cat === 'reuniao' || info.cat === 'negociacao') {
      entry.cats.add(info.cat)
    }
  }

  // Disparos diretos contribuem (call/whatsapp/email/note → contato; meeting → reunião)
  for (const a of (activitiesRes.data ?? []) as Array<{
    lead_id: string; type: string; metadata: Record<string, unknown> | null
  }>) {
    const entry = byLead.get(a.lead_id)
    if (!entry) continue   // ignora leads sem pipeline
    if (a.type === 'meeting') {
      entry.cats.add('reuniao')
    } else if (['call', 'whatsapp', 'email', 'note'].includes(a.type)) {
      entry.cats.add('contato')
    } else if (a.type === 'stage_change') {
      // Histórico: lead passou por stage de contato/reunião/negociação
      const toName = (a.metadata as Record<string, string> | null)?.to
      if (!toName) continue
      const cat = stageNameCatGlobal.get(toName)
      if (cat === 'contato' || cat === 'reuniao' || cat === 'negociacao') {
        entry.cats.add(cat)
      }
    }
  }

  // FECHADO e LOST vem APENAS do status do lead — nunca de stage ou histórico.
  // Garantia: 3 leads convertidos = 3 em "fechado" (não duplica via stage).
  for (const [leadId, entry] of byLead) {
    const status = leadStatus.get(leadId)
    if (status === 'converted') entry.cats.add('fechado')
    if (status === 'lost')      entry.cats.add('lost')
  }

  return {
    byLead,
    pipelines: (pipelinesRes.data ?? []) as Array<{ id: string; name: string; color: string; position: number }>,
  }
}

// ── Breakdown por PIPELINE — categorias por disparos + stage + status ──────
// Cada coluna é uma categoria INDEPENDENTE (não cumulativa).
// Lead conta uma vez por pipeline em que tem card. Mesmo lead em 2 pipelines
// conta nas duas (por isso somar todas != total do funil).
export async function fetchPipelineBreakdown(tenantId: string): Promise<PipelineBreakdown[]> {
  const { byLead, pipelines } = await fetchLeadCategorization(tenantId)

  // Inicializa buckets por pipeline
  type Bucket = {
    leadSet:    Set<string>
    contatos:   Set<string>
    reunioes:   Set<string>
    negociacao: Set<string>
    fechado:    Set<string>
    lost:       Set<string>
  }
  const buckets = new Map<string, Bucket>()
  for (const p of pipelines) {
    buckets.set(p.id, {
      leadSet: new Set(), contatos: new Set(), reunioes: new Set(),
      negociacao: new Set(), fechado: new Set(), lost: new Set(),
    })
  }

  // Distribui cada lead em CADA pipeline em que ele tem card.
  // Categorias independentes (não cumulativo).
  for (const [leadId, data] of byLead) {
    for (const pipelineId of data.pipelines) {
      const bucket = buckets.get(pipelineId)
      if (!bucket) continue
      bucket.leadSet.add(leadId)
      if (data.cats.has('contato'))    bucket.contatos.add(leadId)
      if (data.cats.has('reuniao'))    bucket.reunioes.add(leadId)
      if (data.cats.has('negociacao')) bucket.negociacao.add(leadId)
      if (data.cats.has('fechado'))    bucket.fechado.add(leadId)
      if (data.cats.has('lost'))       bucket.lost.add(leadId)
    }
  }

  return pipelines.map((p) => {
    const b = buckets.get(p.id)
    const leads      = b?.leadSet.size    ?? 0
    const contatos   = b?.contatos.size   ?? 0
    const reunioes   = b?.reunioes.size   ?? 0
    const negociacao = b?.negociacao.size ?? 0
    const won        = b?.fechado.size    ?? 0
    const lost       = b?.lost.size       ?? 0
    const txMarcacaoReuniao = contatos   > 0 ? Math.round((reunioes   / contatos)   * 100) : 0
    const txComparecimento  = reunioes   > 0 ? Math.round((negociacao / reunioes)   * 100) : 0
    const txConversao       = negociacao > 0 ? Math.round((won        / negociacao) * 100) : 0
    return {
      pipelineId:        p.id,
      pipelineName:      p.name,
      color:             p.color,
      leads,
      contatosFeitos:    contatos,
      reunioes,
      negociacao,
      conversions:       won,
      declined:          lost,
      txMarcacaoReuniao,
      txComparecimento,
      txConversao,
    }
  })
}

// ── Totais GLOBAIS — soma de todas as pipelines, sem duplicar lead ──────────
// Cada lead conta UMA VEZ em cada categoria, mesmo que tenha card em várias
// pipelines. Usado pelo Funil de Conversão.
export interface FunnelTotals {
  contato:    number
  reuniao:    number
  negociacao: number
  fechado:    number
  lost:       number
  totalLeads: number
}

export async function fetchFunnelTotals(tenantId: string): Promise<FunnelTotals> {
  const { byLead } = await fetchLeadCategorization(tenantId)
  let contato = 0, reuniao = 0, negociacao = 0, fechado = 0, lost = 0
  for (const [, data] of byLead) {
    if (data.cats.has('contato'))    contato++
    if (data.cats.has('reuniao'))    reuniao++
    if (data.cats.has('negociacao')) negociacao++
    if (data.cats.has('fechado'))    fechado++
    if (data.cats.has('lost'))       lost++
  }
  return { contato, reuniao, negociacao, fechado, lost, totalLeads: byLead.size }
}

// Tipos de atividade que ATRIBUÍMOS a cada coluna
// Contatos Feitos = QUALQUER disparo manual (note/anotação também é contato)
const CONTATO_ACT_TYPES    = new Set(['call', 'whatsapp', 'email', 'meeting', 'note'])
// Reuniões/Negociação = reunião agendada
const NEGOCIACAO_ACT_TYPES = new Set(['meeting'])

export async function fetchChannelBreakdown(tenantId: string): Promise<ChannelBreakdown[]> {
  // Busca tudo em paralelo: leads, canais, disparos, pipeline_cards, stages, funnel_steps
  const [
    leadsRes, channelsRes, activitiesRes,
    cardsRes, stagesRes, funnelStepsRes,
  ] = await Promise.all([
    supabase.from('leads')
      .select('id, channel_id, status')
      .eq('tenant_id', tenantId),
    supabase.from('lead_channels')
      .select('id, name, color, position')
      .eq('tenant_id', tenantId)
      .order('position'),
    supabase.from('lead_activities')
      .select('lead_id, type, metadata')
      .eq('tenant_id', tenantId),
    supabase.from('pipeline_cards')
      .select('lead_id, stage_id')
      .eq('tenant_id', tenantId),
    supabase.from('pipeline_stages')
      .select('id, name, funnel_step_id')
      .eq('tenant_id', tenantId),
    supabase.from('funnel_steps')
      .select('id, name, activity_types, position')
      .eq('tenant_id', tenantId)
      .order('position'),
  ])

  if (leadsRes.error)         throw leadsRes.error
  if (channelsRes.error)      throw channelsRes.error
  if (activitiesRes.error)    throw activitiesRes.error
  if (cardsRes.error)         throw cardsRes.error
  if (stagesRes.error)        throw stagesRes.error
  if (funnelStepsRes.error)   throw funnelStepsRes.error

  // 1. Identifica IDs dos passos do funil que casam com cada coluna
  const funnelSteps    = funnelStepsRes.data ?? []
  const contatoStepIds    = new Set(funnelSteps.filter((s) => isContatoStep(s.name)).map((s) => s.id))
  const negociacaoStepIds = new Set(funnelSteps.filter((s) => isNegociacaoStep(s.name)).map((s) => s.id))

  // 2. Mapa stage_id → funnel_step_id; e nome da etapa → funnel_step_id
  const stages = stagesRes.data ?? []
  const stageIdToFunnel = new Map<string, string | null>()
  const stageNameToFunnel = new Map<string, string | null>()
  for (const s of stages) {
    stageIdToFunnel.set(s.id, s.funnel_step_id ?? null)
    stageNameToFunnel.set(s.name, s.funnel_step_id ?? null)
  }

  // 3. Para cada lead, calcula em quais conceitos ele se encaixa (contato / negociacao)
  // Combinando: DISPAROS + PIPELINE ATUAL + HISTÓRICO de stage_change
  // Considera todos os leads exceto archived (lost ainda foi contatado)
  const validLeadIds = new Set(
    (leadsRes.data ?? [])
      .filter((l) => l.status !== 'archived')
      .map((l) => l.id),
  )

  const leadMatchesContato    = new Set<string>()
  const leadMatchesNegociacao = new Set<string>()

  // 3a. Por disparo direto
  for (const a of activitiesRes.data ?? []) {
    if (!validLeadIds.has(a.lead_id)) continue
    if (CONTATO_ACT_TYPES.has(a.type))    leadMatchesContato.add(a.lead_id)
    if (NEGOCIACAO_ACT_TYPES.has(a.type)) leadMatchesNegociacao.add(a.lead_id)
  }

  // 3b. Por pipeline atual: lead está em stage mapeada
  for (const c of cardsRes.data ?? []) {
    if (!validLeadIds.has(c.lead_id)) continue
    const fsId = stageIdToFunnel.get(c.stage_id)
    if (!fsId) continue
    if (contatoStepIds.has(fsId))    leadMatchesContato.add(c.lead_id)
    if (negociacaoStepIds.has(fsId)) leadMatchesNegociacao.add(c.lead_id)
  }

  // 3c. Por histórico: stage_change com metadata->to = nome de stage mapeada
  for (const a of activitiesRes.data ?? []) {
    if (a.type !== 'stage_change') continue
    if (!validLeadIds.has(a.lead_id)) continue
    const toName = (a.metadata as Record<string, string> | null)?.to
    if (!toName) continue
    const fsId = stageNameToFunnel.get(toName)
    if (!fsId) continue
    if (contatoStepIds.has(fsId))    leadMatchesContato.add(a.lead_id)
    if (negociacaoStepIds.has(fsId)) leadMatchesNegociacao.add(a.lead_id)
  }

  // 4. Agrupa por canal e conta
  const buckets = new Map<string | null, {
    leads: number; contatos: number; reunioes: number; conversions: number; declined: number
  }>()
  for (const l of leadsRes.data ?? []) {
    const key = l.channel_id ?? null
    if (!buckets.has(key)) buckets.set(key, { leads: 0, contatos: 0, reunioes: 0, conversions: 0, declined: 0 })
    const b = buckets.get(key)!
    b.leads++
    if (leadMatchesContato.has(l.id))    b.contatos++
    if (leadMatchesNegociacao.has(l.id)) b.reunioes++
    if (l.status === 'converted')        b.conversions++
    if (l.status === 'lost')             b.declined++
  }

  // 5. Constrói resultado mantendo ordem dos canais + "Sem categoria" no final
  const result: ChannelBreakdown[] = []
  for (const c of channelsRes.data ?? []) {
    const b = buckets.get(c.id) ?? { leads: 0, contatos: 0, reunioes: 0, conversions: 0, declined: 0 }
    result.push({
      channelId:      c.id,
      channelName:    c.name,
      color:          c.color,
      leads:          b.leads,
      contatosFeitos: b.contatos,
      reunioes:       b.reunioes,
      conversions:    b.conversions,
      declined:       b.declined,
      meetingRate:    b.leads > 0 ? Math.round((b.reunioes    / b.leads) * 100) : 0,
      convRate:       b.leads > 0 ? Math.round((b.conversions / b.leads) * 100) : 0,
    })
  }
  const noCat = buckets.get(null)
  if (noCat && noCat.leads > 0) {
    result.push({
      channelId:      null,
      channelName:    'Sem categoria',
      color:          '#555',
      leads:          noCat.leads,
      contatosFeitos: noCat.contatos,
      reunioes:       noCat.reunioes,
      conversions:    noCat.conversions,
      declined:       noCat.declined,
      meetingRate:    Math.round((noCat.reunioes    / noCat.leads) * 100),
      convRate:       Math.round((noCat.conversions / noCat.leads) * 100),
    })
  }
  return result
}

// ── Taxas globais: reunião, conversão, decline ───────────────────────────────

export async function fetchConversionFunnelMetrics(tenantId: string): Promise<ConversionFunnelMetrics> {
  const [leadsRes, meetingsRes] = await Promise.all([
    supabase.from('leads').select('id, status').eq('tenant_id', tenantId),
    supabase.from('lead_activities').select('lead_id').eq('tenant_id', tenantId).eq('type', 'meeting'),
  ])

  if (leadsRes.error)    throw leadsRes.error
  if (meetingsRes.error) throw meetingsRes.error

  const leads = leadsRes.data ?? []
  const meetingLeadIds = new Set((meetingsRes.data ?? []).map((m) => m.lead_id))

  const totalLeads     = leads.length
  const meetingsCount  = leads.filter((l) => meetingLeadIds.has(l.id)).length
  const convertedCount = leads.filter((l) => l.status === 'converted').length
  const declinedCount  = leads.filter((l) => l.status === 'lost').length

  return {
    totalLeads, meetingsCount, convertedCount, declinedCount,
    meetingRate: totalLeads > 0 ? Math.round((meetingsCount / totalLeads) * 100) : 0,
    convRate:    totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0,
    declineRate: totalLeads > 0 ? Math.round((declinedCount / totalLeads) * 100) : 0,
  }
}

// ── Funil por pipeline (CUMULATIVO — quantos leads JÁ PASSARAM por cada etapa) ──
// Usa as próprias etapas da pipeline (na ordem) + a JORNADA de cada lead:
// - etapa atual do lead (ativo em X já passou por X)
// - histórico de movimentação (lead_activities type='stage_change', metadata
//   {from,to} com os nomes das etapas) → reconstrói por onde o lead passou,
//   inclusive os que já saíram (perdidos). É o que responde "quantos passaram
//   de etapa por etapa", não só o momento atual.
// Ganhos passaram por todas as etapas. Todo lead que entrou conta na 1ª etapa.

export interface PipelineFunnelStage {
  id:        string
  name:      string
  color:     string
  atStage:   number   // leads ativos parados exatamente nesta etapa (agora)
  reached:   number   // leads que JÁ PASSARAM por esta etapa (ou além)
  pctOfTop:  number   // reached / topo do funil (% do total que entrou)
  pctOfPrev: number   // reached / etapa anterior (conversão etapa a etapa)
}

export interface PipelineFunnelData {
  stages:   PipelineFunnelStage[]
  entered:  number    // total de leads que entraram (todos os cards da pipeline)
  active:   number    // ainda ativos nas etapas de andamento
  won:      number
  wonValue: number
  lost:     number
  archived: number
  convRate: number    // ganhos / entraram
}

// Papel da etapa no funil. Usa stage_type (quando o usuário configurou) e,
// como reforço, o NOME — porque na prática muita etapa de desfecho ("Fechado",
// "Perdido", "Noshow", "Inativos") ficou marcada como in_progress. Assim essas
// etapas não viram degraus vazios no funil e os leads caem no bucket certo.
type StageRole = 'won' | 'lost' | 'archived' | 'flow'
function stageRole(name: string, stageType: string | null): StageRole {
  if (stageType === 'won')      return 'won'
  if (stageType === 'lost')     return 'lost'
  if (stageType === 'archived') return 'archived'
  const n = (name || '').toLowerCase()
  if (/arquiv|archiv/.test(n))                                                              return 'archived'
  if (/fechad|ganho|convertid|\bwon\b|conclu[ií]|contrato assinado/.test(n))                return 'won'
  if (/perdid|\blost\b|n[ãa]o ?fechou|recusad|declin|cancelad|churn|chrun|inativ|desqualif|descartad|n[ãa]o ?[ée] ?lead|no[-\s]?show|noshow/.test(n)) return 'lost'
  return 'flow'
}

export async function fetchPipelineFunnel(
  tenantId: string, pipelineId: string,
): Promise<PipelineFunnelData> {
  const empty: PipelineFunnelData = {
    stages: [], entered: 0, active: 0, won: 0, wonValue: 0, lost: 0, archived: 0, convRate: 0,
  }

  const { data: stages, error: sErr } = await supabase
    .from('pipeline_stages')
    .select('id, name, color, position, stage_type')
    .eq('tenant_id', tenantId)
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
  if (sErr) throw sErr
  const stageList = stages ?? []
  if (stageList.length === 0) return empty

  const norm      = (s: string) => (s || '').trim().toLowerCase()
  const roleById  = new Map(stageList.map((s) => [s.id, stageRole(s.name, s.stage_type)]))
  const stageIds  = stageList.map((s) => s.id)

  // Etapas de "fluxo" = degraus reais do funil (na ordem). Desfechos ficam fora.
  const flowStages   = stageList.filter((s) => roleById.get(s.id) === 'flow')
  const flowIdxById  = new Map(flowStages.map((s, i) => [s.id, i]))
  const flowIdxByName = new Map(flowStages.map((s, i) => [norm(s.name), i]))
  const lastFlow     = flowStages.length - 1

  const { data: cards, error: cErr } = await supabase
    .from('pipeline_cards')
    .select('lead_id, stage_id, leads(status, value)')
    .eq('tenant_id', tenantId)
    .in('stage_id', stageIds)
  if (cErr) throw cErr
  type CardRow = {
    lead_id: string; stage_id: string
    leads: { status: string; value: number | null } | { status: string; value: number | null }[] | null
  }
  const cardList = (cards ?? []) as CardRow[]

  // ── REGRA DE DEDUP: 1 lead = 1 posição no funil ──────────────────────────
  // Cada lead conta UMA única vez. Se (por qualquer anomalia) o lead tiver mais
  // de um card nesta pipeline, fica com o card MAIS AVANÇADO (maior posição) =
  // onde ele realmente está. Isso garante que histórico repetido, idas e voltas
  // ou cards duplicados nunca inflem a contagem.
  const posOfStage = new Map(stageList.map((s) => [s.id, s.position ?? 0]))
  const leadNow    = new Map<string, { stageId: string; status: string; value: number }>()
  for (const c of cardList) {
    const lead    = Array.isArray(c.leads) ? c.leads[0] : c.leads
    const prev    = leadNow.get(c.lead_id)
    const curPos  = posOfStage.get(c.stage_id) ?? -1
    const prevPos = prev ? (posOfStage.get(prev.stageId) ?? -1) : Number.NEGATIVE_INFINITY
    if (!prev || curPos > prevPos) {
      leadNow.set(c.lead_id, {
        stageId: c.stage_id,
        status:  lead?.status ?? 'active',
        value:   Number(lead?.value ?? 0),
      })
    }
  }

  // Histórico de movimentação → maior etapa de FLUXO já visitada por cada lead.
  // Só considera leads DESTA pipeline (leadNow) e nomes de etapa DESTA pipeline.
  // Usa o MÁXIMO por lead — evento repetido/duplicado nunca conta duas vezes.
  const histMaxByLead = new Map<string, number>()
  if (flowStages.length > 0 && leadNow.size > 0) {
    const { data: acts } = await supabase
      .from('lead_activities')
      .select('lead_id, metadata')
      .eq('tenant_id', tenantId)
      .eq('type', 'stage_change')
    for (const a of (acts ?? []) as Array<{ lead_id: string; metadata: { from?: string; to?: string } | null }>) {
      if (!leadNow.has(a.lead_id)) continue    // só leads que estão nesta pipeline
      const md = a.metadata
      if (!md) continue
      for (const nm of [md.from, md.to]) {
        if (!nm) continue
        const idx = flowIdxByName.get(norm(nm))
        if (idx == null) continue
        const cur = histMaxByLead.get(a.lead_id) ?? -1
        if (idx > cur) histMaxByLead.set(a.lead_id, idx)
      }
    }
  }

  const atFlow    = new Array(flowStages.length).fill(0)  // ativos parados AGORA em cada etapa
  const furthest  = new Array(flowStages.length).fill(0)  // tally: nº de leads cuja etapa MAIS distante alcançada = i
  let won = 0, wonValue = 0, lost = 0, archived = 0, entered = 0

  // Um lead por iteração (já deduplicado em leadNow)
  for (const [leadId, info] of leadNow) {
    const role = roleById.get(info.stageId)
    if (!role) continue
    const st    = info.status
    const value = info.value
    entered++

    // Bucket de desfecho: STATUS do lead primeiro (fonte de verdade), depois o papel da etapa
    let bucket: StageRole | 'flow'
    if (st === 'converted')      bucket = 'won'
    else if (st === 'archived')  bucket = 'archived'
    else if (st === 'lost')      bucket = 'lost'
    else if (role === 'won')     bucket = 'won'
    else if (role === 'archived')bucket = 'archived'
    else if (role === 'lost')    bucket = 'lost'
    else                         bucket = 'flow'

    if (bucket === 'won')      { won++; wonValue += value }
    else if (bucket === 'lost')     lost++
    else if (bucket === 'archived') archived++

    if (flowStages.length === 0) continue

    // Etapa mais distante alcançada = max(etapa atual se for fluxo, histórico, e
    // "todas" se ganhou). Piso 0: todo lead que entrou passou pela 1ª etapa.
    let maxPos = -1
    const curIdx = flowIdxById.get(info.stageId)
    if (curIdx != null) maxPos = curIdx
    const h = histMaxByLead.get(leadId)
    if (h != null && h > maxPos) maxPos = h
    if (bucket === 'won') maxPos = lastFlow          // ganho passou por tudo
    if (maxPos < 0)        maxPos = 0
    if (maxPos > lastFlow) maxPos = lastFlow
    furthest[maxPos]++

    // "Parados aqui agora" = só ativos que estão nesta etapa de fluxo
    if (bucket === 'flow' && curIdx != null) atFlow[curIdx]++
  }

  // reached[i] = leads cuja etapa mais distante foi >= i (cumulativo)
  const reached = flowStages.map((_, i) => {
    let sum = 0
    for (let j = i; j < furthest.length; j++) sum += furthest[j]
    return sum
  })
  const top    = reached[0] || 1
  const active = atFlow.reduce((a, b) => a + b, 0)

  const stagesOut: PipelineFunnelStage[] = flowStages.map((s, i) => ({
    id:        s.id,
    name:      s.name,
    color:     s.color || '#40a0ff',
    atStage:   atFlow[i],
    reached:   reached[i],
    pctOfTop:  Math.round((reached[i] / top) * 100),
    pctOfPrev: i === 0 ? 100 : (reached[i - 1] > 0 ? Math.round((reached[i] / reached[i - 1]) * 100) : 0),
  }))

  return {
    stages: stagesOut, entered, active, won, wonValue, lost, archived,
    convRate: entered > 0 ? Math.round((won / entered) * 100) : 0,
  }
}
