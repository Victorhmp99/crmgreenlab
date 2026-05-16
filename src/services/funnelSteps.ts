import { supabase } from '@/lib/supabase'
import type { FunnelStep, FunnelMetric, ActivityType } from '@/types'

export interface CreateFunnelStepData {
  name:            string
  description?:    string | null
  color?:          string
  activity_types?: ActivityType[] | null
}

export type UpdateFunnelStepData = Partial<Pick<FunnelStep, 'name' | 'description' | 'color' | 'activity_types'>>

export async function fetchFunnelSteps(tenantId: string): Promise<FunnelStep[]> {
  const { data, error } = await supabase.rpc('get_funnel_steps', { p_tenant_id: tenantId })
  if (error) throw error

  return ((data ?? []) as Array<{
    id: string; name: string; description: string | null;
    color: string; step_position: number; activity_types: ActivityType[] | null;
    created_at: string;
  }>).map((row) => ({
    id:             row.id,
    name:           row.name,
    description:    row.description,
    color:          row.color,
    position:       row.step_position,
    activity_types: row.activity_types,
    created_at:     row.created_at,
  }))
}

export async function fetchFunnelMetrics(tenantId: string): Promise<FunnelMetric[]> {
  const { data, error } = await supabase.rpc('get_funnel_metrics', { p_tenant_id: tenantId })
  if (error) throw error

  return ((data ?? []) as Array<{
    step_id: string; step_name: string; step_color: string;
    step_position: number; count_in_step: number;
    count_at_or_beyond: number; count_lost_here: number;
  }>).map((row) => ({
    stepId:           row.step_id,
    stepName:         row.step_name,
    stepColor:        row.step_color,
    stepPosition:     row.step_position,
    countInStep:      Number(row.count_in_step),
    countAtOrBeyond:  Number(row.count_at_or_beyond),
    countLostHere:    Number(row.count_lost_here),
  }))
}

export async function createFunnelStep(
  tenantId: string,
  data:     CreateFunnelStepData,
): Promise<FunnelStep> {
  const { data: existing } = await supabase
    .from('funnel_steps')
    .select('position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPos = ((existing?.[0]?.position ?? -1) as number) + 1

  const { data: created, error } = await supabase
    .from('funnel_steps')
    .insert({
      tenant_id:      tenantId,
      name:           data.name.trim(),
      description:    data.description ?? null,
      color:          data.color ?? '#40a0ff',
      position:       nextPos,
      activity_types: data.activity_types ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return created as FunnelStep
}

export async function updateFunnelStep(id: string, data: UpdateFunnelStepData): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.name           !== undefined) payload.name           = data.name.trim()
  if (data.description    !== undefined) payload.description    = data.description
  if (data.color          !== undefined) payload.color          = data.color
  if (data.activity_types !== undefined) payload.activity_types = data.activity_types

  const { error } = await supabase.from('funnel_steps').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteFunnelStep(id: string): Promise<void> {
  const { error } = await supabase.from('funnel_steps').delete().eq('id', id)
  if (error) throw error
}

export async function reorderFunnelSteps(
  tenantId: string,
  updates:  Array<{ id: string; position: number }>,
): Promise<void> {
  const { error } = await supabase.rpc('reorder_funnel_steps', {
    p_tenant_id: tenantId,
    p_updates:   updates,
  })
  if (error) throw error
}
