import { supabase } from '@/lib/supabase'
import type { PipelineStage, PipelineCard, Lead } from '@/types'

// ── Tipos específicos do pipeline ────────────────────────────────────────────

export interface KanbanCardData {
  card: PipelineCard
  lead: Lead
}

export interface ColumnData {
  stage: PipelineStage
  cards: KanbanCardData[]
}

// ── Stages ───────────────────────────────────────────────────────────────────

export async function fetchPipelineStages(tenantId: string): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (error) throw error

  // Cria etapas padrão se o tenant ainda não tiver nenhuma
  if (!data || data.length === 0) {
    await supabase.rpc('create_default_pipeline_stages', { p_tenant_id: tenantId })

    const { data: seeded, error: seedError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })

    if (seedError) throw seedError
    return seeded ?? []
  }

  return data
}

// ── Cards (leads no kanban) ───────────────────────────────────────────────────

export async function fetchPipelineCards(tenantId: string): Promise<KanbanCardData[]> {
  const { data, error } = await supabase
    .from('pipeline_cards')
    .select(`
      id,
      lead_id,
      stage_id,
      position,
      moved_at,
      moved_by,
      tenant_id,
      leads (
        id, tenant_id, assigned_to, name, company_name, phone, email,
        status, source, source_campaign, notes, tags,
        custom_fields, value, channel_id, created_at, updated_at
      )
    `)
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (error) throw error

  console.log('[fetchPipelineCards] data bruto do banco:', data?.slice(0, 3))

  return (data ?? [])
    .filter((row) => row.leads !== null)
    .map((row) => ({
      card: {
        id:        row.id,
        lead_id:   row.lead_id,
        stage_id:  row.stage_id,
        position:  row.position,
        moved_at:  row.moved_at,
        moved_by:  row.moved_by,
        tenant_id: row.tenant_id,
      } as PipelineCard,
      lead: row.leads as unknown as Lead,
    }))
}

// ── Mover card entre colunas ──────────────────────────────────────────────────

export async function moveCard(
  cardId: string,
  newStageId: string,
  newPosition: number,
  movedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('pipeline_cards')
    .update({ stage_id: newStageId, position: newPosition, moved_at: new Date().toISOString(), moved_by: movedBy })
    .eq('id', cardId)

  if (error) throw error
}

// Reordena vários cards de uma coluna de uma vez (batch update)
export async function reorderCards(
  updates: Array<{ id: string; position: number }>,
): Promise<void> {
  const promises = updates.map(({ id, position }) =>
    supabase.from('pipeline_cards').update({ position }).eq('id', id),
  )
  const results = await Promise.all(promises)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

// ── Adicionar lead ao pipeline ────────────────────────────────────────────────

export async function addLeadToPipeline(
  tenantId: string,
  leadId: string,
  stageId: string,
  position: number,
): Promise<PipelineCard> {
  const { data, error } = await supabase
    .from('pipeline_cards')
    .insert({ tenant_id: tenantId, lead_id: leadId, stage_id: stageId, position })
    .select()
    .single()

  if (error) throw error
  return data as PipelineCard
}

// ── Remover lead do pipeline ─────────────────────────────────────────────────

export async function removeFromPipeline(cardId: string): Promise<void> {
  const { error } = await supabase.from('pipeline_cards').delete().eq('id', cardId)
  if (error) throw error
}

// ── Leads que ainda não estão no pipeline ────────────────────────────────────

export async function fetchLeadsNotInPipeline(tenantId: string): Promise<Lead[]> {
  // Busca todos os lead_ids já no pipeline
  const { data: cards } = await supabase
    .from('pipeline_cards')
    .select('lead_id')
    .eq('tenant_id', tenantId)

  const excludeIds = (cards ?? []).map((c: { lead_id: string }) => c.lead_id)

  let query = supabase
    .from('leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ── Log de mudança de etapa ───────────────────────────────────────────────────

export async function logStageChange(
  tenantId: string,
  leadId: string,
  userId: string,
  fromStageName: string,
  toStageName: string,
): Promise<void> {
  await supabase.from('lead_activities').insert({
    tenant_id:   tenantId,
    lead_id:     leadId,
    user_id:     userId,
    type:        'stage_change',
    description: `Movido de "${fromStageName}" para "${toStageName}"`,
    metadata:    { from: fromStageName, to: toStageName },
  })
}
