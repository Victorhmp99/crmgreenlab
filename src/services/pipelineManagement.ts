import { supabase } from '@/lib/supabase'
import type { PipelineStage } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Pipeline {
  id:                string
  tenant_id:         string
  name:              string
  description:       string | null
  color:             string
  position:          number
  start_stage_id:    string | null        // etapa de entrada para automações/webhooks
  webhook_field_keys: string[] | null      // campos personalizados que esta automação preenche; null = todos os ativos
  created_at:        string
}

// ── CRUD de Pipelines ─────────────────────────────────────────────────────────

export async function fetchPipelines(tenantId: string): Promise<Pipeline[]> {
  // 1ª visita: cria o pipeline padrão se não existir nenhum
  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (error) throw error

  if (!data || data.length === 0) {
    const { error: rpcError } = await supabase
      .rpc('create_pipeline_with_defaults', { p_tenant_id: tenantId, p_name: 'Principal' })

    if (rpcError) throw rpcError

    const { data: fresh, error: freshError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position')

    if (freshError) throw freshError
    return (fresh ?? []) as Pipeline[]
  }

  return data as Pipeline[]
}

export async function createPipeline(
  tenantId: string,
  name:     string,
  color:    string,
): Promise<Pipeline> {
  const { data, error } = await supabase
    .rpc('create_pipeline_with_defaults', {
      p_tenant_id: tenantId,
      p_name:      name,
      p_color:     color,
    })

  if (error) throw error

  // Busca o pipeline criado pelo id retornado
  const { data: pipeline, error: fetchError } = await supabase
    .from('pipelines')
    .select('*')
    .eq('id', data)
    .single()

  if (fetchError) throw fetchError
  return pipeline as Pipeline
}

/** Cria pipeline sem etapas padrão (usado pelo wizard) */
export async function createPipelineEmpty(
  tenantId: string,
  name:     string,
  color:    string,
): Promise<Pipeline> {
  // pega a maior posição existente para ordenar ao final
  const { data: existing } = await supabase
    .from('pipelines')
    .select('position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = ((existing?.[0]?.position ?? -1) as number) + 1

  const { data, error } = await supabase
    .from('pipelines')
    .insert({ tenant_id: tenantId, name, color, position: nextPosition })
    .select()
    .single()

  if (error) throw error
  return data as Pipeline
}

export async function updatePipeline(
  id:   string,
  data: Partial<Pick<Pipeline, 'name' | 'color' | 'description' | 'start_stage_id' | 'webhook_field_keys'>>,
): Promise<void> {
  const { error } = await supabase.from('pipelines').update(data).eq('id', id)
  if (error) throw error
}

export async function deletePipeline(id: string, tenantId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_pipeline', {
    p_pipeline_id: id,
    p_tenant_id:   tenantId,
  })
  if (error) throw error
}

export async function reorderPipelines(
  updates: Array<{ id: string; position: number }>,
): Promise<void> {
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('pipelines').update({ position }).eq('id', id),
    ),
  )
}

// ── CRUD de Etapas ────────────────────────────────────────────────────────────

/** Busca TODAS as etapas do tenant de uma vez (usado para stats do grid) */
export async function fetchAllStages(tenantId: string): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []) as PipelineStage[]
}

export async function fetchStagesByPipeline(
  tenantId:   string,
  pipelineId: string,
): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createStage(
  tenantId:   string,
  pipelineId: string,
  name:       string,
  color:      string,
  position:   number,
): Promise<PipelineStage> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({ tenant_id: tenantId, pipeline_id: pipelineId, name, color, position, is_final: false })
    .select()
    .single()

  if (error) throw error
  return data as PipelineStage
}

export async function updateStage(
  id:   string,
  data: Partial<Pick<PipelineStage,
    'name' | 'color' | 'position' | 'is_final' | 'stage_type' | 'funnel_step_id' | 'meta_event'>>,
): Promise<void> {
  const { error } = await supabase.from('pipeline_stages').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await supabase.from('pipeline_stages').delete().eq('id', id)
  if (error) throw error
}

export async function reorderStagesService(
  updates: Array<{ id: string; position: number }>,
): Promise<void> {
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('pipeline_stages').update({ position }).eq('id', id),
    ),
  )
}
