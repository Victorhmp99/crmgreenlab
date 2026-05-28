import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PipelineAutomationConfig {
  /** ID da pipeline atualmente vinculada ao WhatsApp (pode ser null) */
  whatsappLinkedPipelineId: string | null
  /** Se o canal WhatsApp está ativo para este tenant */
  whatsappActive: boolean
  /** Chave do webhook para formulários externos */
  webhookKey: string | null
  /** URL base do Supabase para montar o endpoint */
  supabaseUrl: string
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function fetchPipelineAutomationConfig(
  tenantId: string,
): Promise<PipelineAutomationConfig> {
  const [waRes, settingsRes] = await Promise.all([
    supabase
      .from('whatsapp_settings')
      .select('pipeline_id, active')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('tenant_settings')
      .select('webhook_key')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ])

  return {
    whatsappLinkedPipelineId: waRes.data?.pipeline_id ?? null,
    whatsappActive:           waRes.data?.active      ?? false,
    webhookKey:               settingsRes.data?.webhook_key ?? null,
    supabaseUrl:              import.meta.env.VITE_SUPABASE_URL ?? '',
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Vincula ou desvincula o canal WhatsApp a uma pipeline */
export async function linkWhatsAppToPipeline(
  tenantId:   string,
  pipelineId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_settings')
    .update({ pipeline_id: pipelineId, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
  if (error) throw error
}

/** Atualiza a etapa de entrada (start_stage) de uma pipeline */
export async function updatePipelineStartStage(
  pipelineId:   string,
  startStageId: string,
): Promise<void> {
  const { error } = await supabase
    .from('pipelines')
    .update({ start_stage_id: startStageId })
    .eq('id', pipelineId)
  if (error) throw error
}
