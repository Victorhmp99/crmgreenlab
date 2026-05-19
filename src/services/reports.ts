import { supabase } from '@/lib/supabase'

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
export interface PipelineBreakdown {
  pipelineId:    string
  pipelineName:  string
  color:         string
  leads:         number  // total de cards na pipeline
  contatosFeitos: number // cards em stages cujo nome bate com "contato"/etc
  reunioes:      number  // cards em stages cujo nome bate com "reuni"/"agenda"/"negoci"
  conversions:   number  // cards em stages stage_type='won'
  declined:      number  // cards em stages stage_type='lost'
  meetingRate:   number  // % reuniões / leads
  convRate:      number  // % conversões / leads
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
  // Usa o funil POR DISPAROS (get_funnel_metrics) — mesma lógica do funil principal.
  // Reflete o histórico real de cada lead, não só o estado atual da pipeline.
  const { data, error } = await supabase.rpc('get_funnel_metrics', { p_tenant_id: tenantId })
  if (error) throw error

  const rows = ((data ?? []) as Array<{
    step_id: string; step_name: string; step_color: string;
    step_position: number; count_in_step: number;
    count_at_or_beyond: number; count_lost_here: number;
  }>)

  const total = rows.reduce((s, r) => s + Number(r.count_in_step), 0)

  return rows.map((r) => {
    const name = r.step_name.toLowerCase()
    // Classifica won/lost/in_progress pelo nome do passo
    const stageType: string =
      /fechad|ganho|won|convertido|contrato/i.test(name) ? 'won' :
      /perdid|lost|recusad|declin/i.test(name)            ? 'lost' :
      'in_progress'
    return {
      stageId:    r.step_id,
      stageName:  r.step_name,
      color:      r.step_color,
      stageType,
      count:      Number(r.count_in_step),
      totalValue: 0,  // funil por disparos não tem valor — vem das atividades, não dos cards
      pct:        total > 0 ? Math.round((Number(r.count_in_step) / total) * 100) : 0,
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

// ── Breakdown por PIPELINE — alimentado pelos DISPAROS de cada lead ─────────
// Cada linha = uma pipeline. Para cada lead na pipeline, conta seus DISPAROS:
//   contatosFeitos = lead tem disparo call/whatsapp/email/note
//   reunioes       = lead tem disparo meeting
//   conversions    = lead.status = 'converted'
//   declined       = lead.status = 'lost'
// Isso reflete o histórico real do lead, não só o estado atual da etapa.
export async function fetchPipelineBreakdown(tenantId: string): Promise<PipelineBreakdown[]> {
  const [pipelinesRes, stagesRes, cardsRes, leadsRes, activitiesRes] = await Promise.all([
    supabase.from('pipelines').select('id, name, color, position')
      .eq('tenant_id', tenantId).order('position'),
    supabase.from('pipeline_stages').select('id, pipeline_id')
      .eq('tenant_id', tenantId),
    supabase.from('pipeline_cards').select('lead_id, stage_id')
      .eq('tenant_id', tenantId),
    supabase.from('leads').select('id, status')
      .eq('tenant_id', tenantId),
    supabase.from('lead_activities').select('lead_id, type')
      .eq('tenant_id', tenantId)
      .in('type', ['call', 'whatsapp', 'email', 'meeting', 'note']),
  ])

  if (pipelinesRes.error)  throw pipelinesRes.error
  if (stagesRes.error)     throw stagesRes.error
  if (cardsRes.error)      throw cardsRes.error
  if (leadsRes.error)      throw leadsRes.error
  if (activitiesRes.error) throw activitiesRes.error

  // Mapa stage_id → pipeline_id
  const stageToPipeline = new Map<string, string>()
  for (const s of (stagesRes.data ?? []) as Array<{ id: string; pipeline_id: string | null }>) {
    if (s.pipeline_id) stageToPipeline.set(s.id, s.pipeline_id)
  }

  // Mapa lead_id → status
  const leadStatus = new Map<string, string>()
  for (const l of (leadsRes.data ?? []) as Array<{ id: string; status: string }>) {
    leadStatus.set(l.id, l.status)
  }

  // Mapa lead_id → { hasContato, hasReuniao }
  // Contato Feito = qualquer disparo manual (call/whatsapp/email/note)
  // Reunião       = disparo 'meeting'
  const leadActs = new Map<string, { contato: boolean; reuniao: boolean }>()
  for (const a of (activitiesRes.data ?? []) as Array<{ lead_id: string; type: string }>) {
    const cur = leadActs.get(a.lead_id) ?? { contato: false, reuniao: false }
    if (a.type === 'meeting')                              cur.reuniao = true
    if (['call', 'whatsapp', 'email', 'note'].includes(a.type)) cur.contato = true
    leadActs.set(a.lead_id, cur)
  }

  // Inicializa um bucket por pipeline + um Set pra evitar contar lead duplicado
  type Bucket = {
    leadSet:   Set<string>
    contatos:  Set<string>
    reunioes:  Set<string>
    won:       Set<string>
    lost:      Set<string>
  }
  const buckets = new Map<string, Bucket>()
  for (const p of (pipelinesRes.data ?? []) as Array<{ id: string }>) {
    buckets.set(p.id, {
      leadSet:  new Set(),
      contatos: new Set(),
      reunioes: new Set(),
      won:      new Set(),
      lost:     new Set(),
    })
  }

  // Distribui cada card (= lead na pipeline) nos buckets
  for (const c of (cardsRes.data ?? []) as Array<{ lead_id: string; stage_id: string }>) {
    const pipelineId = stageToPipeline.get(c.stage_id)
    if (!pipelineId) continue
    const bucket = buckets.get(pipelineId)
    if (!bucket) continue

    bucket.leadSet.add(c.lead_id)

    // Disparos
    const acts = leadActs.get(c.lead_id)
    if (acts?.contato) bucket.contatos.add(c.lead_id)
    if (acts?.reuniao) bucket.reunioes.add(c.lead_id)

    // Status do lead
    const status = leadStatus.get(c.lead_id)
    if (status === 'converted') bucket.won.add(c.lead_id)
    if (status === 'lost')      bucket.lost.add(c.lead_id)
  }

  // Monta resultado preservando ordem das pipelines
  return ((pipelinesRes.data ?? []) as Array<{ id: string; name: string; color: string; position: number }>)
    .map((p) => {
      const b = buckets.get(p.id)
      const leads     = b?.leadSet.size  ?? 0
      const contatos  = b?.contatos.size ?? 0
      const reunioes  = b?.reunioes.size ?? 0
      const won       = b?.won.size      ?? 0
      const lost      = b?.lost.size     ?? 0
      return {
        pipelineId:     p.id,
        pipelineName:   p.name,
        color:          p.color,
        leads,
        contatosFeitos: contatos,
        reunioes,
        conversions:    won,
        declined:       lost,
        meetingRate:    leads > 0 ? Math.round((reunioes / leads) * 100) : 0,
        convRate:       leads > 0 ? Math.round((won      / leads) * 100) : 0,
      }
    })
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

  // DEBUG — abra o console (F12) pra ver o que foi contado
  if (typeof window !== 'undefined') {
    console.log('[ChannelBreakdown] funnelSteps:', funnelSteps.map(s => `${s.position} "${s.name}"`))
    console.log('[ChannelBreakdown] contatoStepIds (passos casados):',
      funnelSteps.filter(s => contatoStepIds.has(s.id)).map(s => s.name))
    console.log('[ChannelBreakdown] negociacaoStepIds (passos casados):',
      funnelSteps.filter(s => negociacaoStepIds.has(s.id)).map(s => s.name))
    console.log('[ChannelBreakdown] leads valid (não-archived):', validLeadIds.size)
    console.log('[ChannelBreakdown] leads matched Contatos:', leadMatchesContato.size)
    console.log('[ChannelBreakdown] leads matched Negociação:', leadMatchesNegociacao.size)
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
