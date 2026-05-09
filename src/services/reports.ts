import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SellerPerformance {
  userId:      string
  email:       string
  fullName:    string | null
  leads:       number
  activities:  number
  conversions: number
  convRate:    number   // % conversão
}

export interface FunnelStageData {
  stageId:   string
  stageName: string
  color:     string
  count:     number
  pct:       number   // % do total de leads no pipeline
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

// ── Performance por vendedor ──────────────────────────────────────────────────

export async function fetchSellerPerformance(
  tenantId:  string,
  startDate: string,
  endDate:   string,
): Promise<SellerPerformance[]> {
  const { data: members } = await supabase
    .from('user_memberships')
    .select('user_id, profiles ( email, full_name )')
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (!members?.length) return []

  const results = await Promise.all(
    members.map(async (m) => {
      const profile = (m.profiles as unknown as { email: string; full_name: string | null } | null)

      const [leadsRes, actRes, convRes] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('assigned_to', m.user_id)
          .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),

        supabase.from('lead_activities').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('user_id', m.user_id)
          .not('type', 'in', '("stage_change","import")')
          .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),

        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('assigned_to', m.user_id)
          .eq('status', 'converted')
          .gte('updated_at', startDate).lte('updated_at', endDate + 'T23:59:59'),
      ])

      const leads       = leadsRes.count  ?? 0
      const activities  = actRes.count    ?? 0
      const conversions = convRes.count   ?? 0

      return {
        userId:      m.user_id,
        email:       profile?.email    ?? '—',
        fullName:    profile?.full_name ?? null,
        leads,
        activities,
        conversions,
        convRate:    leads > 0 ? Math.round((conversions / leads) * 100) : 0,
      }
    }),
  )

  return results.sort((a, b) => b.leads - a.leads)
}

// ── Distribuição do funil por etapa ──────────────────────────────────────────

export async function fetchFunnelBreakdown(tenantId: string): Promise<FunnelStageData[]> {
  const [stagesRes, cardsRes] = await Promise.all([
    supabase.from('pipeline_stages').select('id, name, color, position')
      .eq('tenant_id', tenantId).order('position'),
    supabase.from('pipeline_cards').select('stage_id')
      .eq('tenant_id', tenantId),
  ])

  const stages = stagesRes.data ?? []
  const cards  = cardsRes.data  ?? []
  const total  = cards.length

  const countByStage = new Map<string, number>()
  for (const c of cards) {
    countByStage.set(c.stage_id, (countByStage.get(c.stage_id) ?? 0) + 1)
  }

  return stages.map((s) => {
    const count = countByStage.get(s.id) ?? 0
    return {
      stageId:   s.id,
      stageName: s.name,
      color:     s.color,
      count,
      pct:       total > 0 ? Math.round((count / total) * 100) : 0,
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

  const map = new Map<string, { leads: number; conversions: number }>()

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
