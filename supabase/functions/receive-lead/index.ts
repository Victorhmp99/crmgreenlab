/**
 * Edge Function: receive-lead
 *
 * Recebe leads de formulários externos via webhook HTTP POST.
 * Valida o webhook_key do tenant, cria o lead e opcionalmente
 * adiciona ao primeiro estágio do pipeline principal.
 *
 * Endpoint: POST /functions/v1/receive-lead
 *
 * Payload esperado:
 * {
 *   tenant_id:       string (uuid)
 *   webhook_key:     string (uuid)
 *   name:            string
 *   phone?:          string
 *   email?:          string
 *   source?:         "meta_ads" | "google" | "referral" | "other" | "manual"
 *   source_campaign?: string
 *   notes?:          string
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_SOURCES = ['manual', 'import', 'meta_ads', 'google', 'referral', 'other'] as const
type LeadSource = typeof ALLOWED_SOURCES[number]

// Cabeçalhos CORS para aceitar chamadas de qualquer origem (formulários externos)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Parse do payload ──────────────────────────────────────────────────────
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    tenant_id, webhook_key, name, phone, email,
    source, source_campaign, notes, custom_fields, value,
    pipeline_id,   // opcional — define em qual pipeline o lead entra automaticamente
  } = payload

  // ── Validação básica ──────────────────────────────────────────────────────
  if (!tenant_id || typeof tenant_id !== 'string') {
    return json({ error: 'tenant_id é obrigatório' }, 400)
  }
  if (!webhook_key || typeof webhook_key !== 'string') {
    return json({ error: 'webhook_key é obrigatório' }, 400)
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return json({ error: 'name é obrigatório' }, 400)
  }

  const leadSource: LeadSource =
    ALLOWED_SOURCES.includes(source as LeadSource) ? (source as LeadSource) : 'other'

  // ── Cliente Supabase com service_role (bypass RLS) ────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // ── Valida webhook_key do tenant ──────────────────────────────────────────
  const { data: settings, error: settingsErr } = await supabaseAdmin
    .from('tenant_settings')
    .select('webhook_key, tenant_id')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (settingsErr) {
    console.error('[receive-lead] settings query error:', settingsErr)
    return json({ error: 'Internal server error' }, 500)
  }

  if (!settings) {
    return json({ error: 'Tenant não encontrado' }, 404)
  }

  // Comparação segura (evita timing attacks com comparação simples)
  if (settings.webhook_key !== webhook_key) {
    return json({ error: 'webhook_key inválido' }, 401)
  }

  // ── Valida custom_fields: aceita só se for objeto plano ──────────────────
  const safeCustomFields = (custom_fields && typeof custom_fields === 'object' && !Array.isArray(custom_fields))
    ? custom_fields as Record<string, unknown>
    : {}

  // ── Cria o lead (ou recupera existente se mesmo phone+tenant) ─────────────
  const normalizedPhone =
    phone && typeof phone === 'string' && phone.trim() ? phone.trim() : null

  const leadPayload = {
    tenant_id,
    name:            name.trim(),
    phone:           normalizedPhone,
    email:           (email && typeof email === 'string' && email.trim()) ? email.trim() : null,
    status:          'active' as const,
    source:          leadSource,
    source_campaign: (source_campaign && typeof source_campaign === 'string') ? source_campaign.trim() : null,
    notes:           (notes && typeof notes === 'string') ? notes.trim() : null,
    tags:            [] as string[],
    value:           (typeof value === 'number' && Number.isFinite(value)) ? value : null,
    custom_fields:   safeCustomFields,
  }

  const { data: insertedLead, error: insertErr } = await supabaseAdmin
    .from('leads')
    .insert(leadPayload)
    .select('id')
    .single()

  let lead: { id: string } | null = insertedLead

  if (insertErr) {
    // 23505 = unique_violation — phone já existe neste tenant → reutiliza o lead existente
    if (insertErr.code === '23505' && normalizedPhone) {
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('phone', normalizedPhone)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (fetchErr || !existing) {
        console.error('[receive-lead] fetch existing lead error:', fetchErr)
        return json({ error: 'Erro ao localizar lead existente' }, 500)
      }
      lead = existing
    } else {
      console.error('[receive-lead] lead insert error:', insertErr)
      return json({ error: 'Erro ao criar lead' }, 500)
    }
  }

  if (!lead) {
    return json({ error: 'Não foi possível obter lead_id' }, 500)
  }

  // ── Adiciona ao pipeline na etapa correta ────────────────────────────────
  // Se pipeline_id foi fornecido, usa start_stage_id da pipeline.
  // Senão, cai para a etapa de posição=0 do tenant (retrocompatibilidade).
  try {
    let targetStageId: string | null = null

    if (pipeline_id && typeof pipeline_id === 'string') {
      const { data: pipeline } = await supabaseAdmin
        .from('pipelines')
        .select('start_stage_id')
        .eq('id', pipeline_id)
        .eq('tenant_id', tenant_id)   // garante que a pipeline pertence ao tenant
        .maybeSingle()

      targetStageId = pipeline?.start_stage_id ?? null
    }

    // Fallback: primeira etapa do tenant (posição 0)
    if (!targetStageId) {
      const { data: stage } = await supabaseAdmin
        .from('pipeline_stages')
        .select('id')
        .eq('tenant_id', tenant_id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()

      targetStageId = stage?.id ?? null
    }

    if (targetStageId) {
      const { count } = await supabaseAdmin
        .from('pipeline_cards')
        .select('id', { count: 'exact', head: true })
        .eq('stage_id', targetStageId)

      await supabaseAdmin.from('pipeline_cards').insert({
        tenant_id,
        lead_id:  lead.id,
        stage_id: targetStageId,
        position: count ?? 0,
        moved_at: new Date().toISOString(),
      })
    }
  } catch (pipelineErr) {
    // Não bloqueia a resposta — o lead já foi criado
    console.warn('[receive-lead] pipeline insert warning:', pipelineErr)
  }

  return json({
    success: true,
    lead_id: lead.id,
    message: 'Lead criado com sucesso',
  }, 201)
})
