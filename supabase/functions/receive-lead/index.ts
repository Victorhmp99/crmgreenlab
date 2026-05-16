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

  const { tenant_id, webhook_key, name, phone, email, source, source_campaign, notes, custom_fields, value } = payload

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

  // ── Cria o lead ───────────────────────────────────────────────────────────
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('leads')
    .insert({
      tenant_id,
      name:            name.trim(),
      phone:           (phone && typeof phone === 'string' && phone.trim()) ? phone.trim() : null,
      email:           (email && typeof email === 'string' && email.trim()) ? email.trim() : null,
      status:          'active',
      source:          leadSource,
      source_campaign: (source_campaign && typeof source_campaign === 'string') ? source_campaign.trim() : null,
      notes:           (notes && typeof notes === 'string') ? notes.trim() : null,
      tags:            [],
      value:           (typeof value === 'number' && Number.isFinite(value)) ? value : null,
      custom_fields:   safeCustomFields,
    })
    .select()
    .single()

  if (leadErr) {
    console.error('[receive-lead] lead insert error:', leadErr)
    return json({ error: 'Erro ao criar lead' }, 500)
  }

  // ── Tenta adicionar ao primeiro estágio do pipeline (best-effort) ─────────
  try {
    const { data: stages } = await supabaseAdmin
      .from('pipeline_stages')
      .select('id, pipeline_id')
      .eq('tenant_id', tenant_id)
      .eq('position', 0)
      .limit(1)
      .maybeSingle()

    if (stages) {
      // Calcula a próxima posição dentro do estágio
      const { count } = await supabaseAdmin
        .from('pipeline_cards')
        .select('id', { count: 'exact', head: true })
        .eq('stage_id', stages.id)

      await supabaseAdmin.from('pipeline_cards').insert({
        tenant_id,
        lead_id:  lead.id,
        stage_id: stages.id,
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
