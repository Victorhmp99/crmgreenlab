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
 *   tenant_id:        string (uuid)
 *   webhook_key:      string (uuid)
 *   pipeline_id?:     string (uuid) — pipeline onde o lead deve entrar
 *   name:             string
 *   phone?:           string
 *   email?:           string
 *   source?:          "meta_ads" | "google" | "referral" | "other" | "manual"
 *   source_campaign?: string
 *   notes?:           string
 *   custom_fields?:   Record<string, string | number | boolean>
 *   _hp?:             string  — honeypot opcional; se vier preenchido, a
 *                      resposta finge sucesso mas nada é gravado no banco
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

// ── Limites anti-abuso ────────────────────────────────────────────────────────
const MAX_BODY_BYTES                  = 50_000  // 50KB — formulário de lead não precisa de mais que isso
const MAX_FIELD_LEN                   = 300     // name, phone, email, source_campaign
const MAX_NOTES_LEN                   = 2000
const MAX_CUSTOM_FIELD_KEYS           = 50
const MAX_CUSTOM_FIELD_VALUE_LEN      = 1000
const RATE_LIMIT_PER_MINUTE_TENANT_IP = 8    // tentativas por tenant+IP por minuto
const RATE_LIMIT_PER_HOUR_TENANT      = 200  // tentativas por tenant por hora (IPs distribuídos)
const RATE_LIMIT_CLEANUP_PROBABILITY  = 0.05 // ~5% das requisições disparam limpeza de linhas antigas

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Comparação de string em tempo constante — evita vazar o webhook_key por timing attack. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/** Sanitiza custom_fields: só aceita string/number/boolean, com limites de quantidade e tamanho. */
function sanitizeCustomFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  const entries = Object.entries(input as Record<string, unknown>).slice(0, MAX_CUSTOM_FIELD_KEYS)
  const safe: Record<string, unknown> = {}

  for (const [key, value] of entries) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 100) continue

    if (typeof value === 'string') {
      safe[key] = value.slice(0, MAX_CUSTOM_FIELD_VALUE_LEN)
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = value
    } else if (typeof value === 'boolean') {
      safe[key] = value
    }
    // objetos, arrays, null, undefined → ignorados silenciosamente
  }

  return safe
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Parse do payload (com limite de tamanho) ───────────────────────────────
  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return json({ error: 'Payload muito grande' }, 413)
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    tenant_id, webhook_key, name, phone, email,
    source, source_campaign, notes, custom_fields, value,
    pipeline_id,   // opcional — define em qual pipeline o lead entra automaticamente
    _hp,           // honeypot opcional
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

  // ── Rate limiting por tenant+IP e por tenant (evita flood/spam) ───────────
  const ip  = clientIp(req)
  const now = new Date()

  const [perMinuteRes, perHourRes] = await Promise.all([
    supabaseAdmin
      .from('webhook_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('ip', ip)
      .gte('created_at', new Date(now.getTime() - 60_000).toISOString()),
    supabaseAdmin
      .from('webhook_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .gte('created_at', new Date(now.getTime() - 3_600_000).toISOString()),
  ])

  if ((perMinuteRes.count ?? 0) >= RATE_LIMIT_PER_MINUTE_TENANT_IP ||
      (perHourRes.count ?? 0) >= RATE_LIMIT_PER_HOUR_TENANT) {
    return json({ error: 'Muitas requisições. Tente novamente mais tarde.' }, 429)
  }

  await supabaseAdmin.from('webhook_rate_limits').insert({ tenant_id, ip })

  if (Math.random() < RATE_LIMIT_CLEANUP_PROBABILITY) {
    await supabaseAdmin
      .from('webhook_rate_limits')
      .delete()
      .lt('created_at', new Date(now.getTime() - 2 * 3_600_000).toISOString())
  }

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

  // Comparação em tempo constante — evita vazar o webhook_key por timing attack
  if (!timingSafeEqual(settings.webhook_key, webhook_key)) {
    return json({ error: 'webhook_key inválido' }, 401)
  }

  // ── Honeypot: se preenchido, finge sucesso sem gravar nada ────────────────
  if (typeof _hp === 'string' && _hp.trim().length > 0) {
    return json({
      success: true,
      lead_id: crypto.randomUUID(),
      message: 'Lead criado com sucesso',
    }, 201)
  }

  // ── Valida e sanitiza custom_fields ────────────────────────────────────────
  const safeCustomFields = sanitizeCustomFields(custom_fields)

  // ── Normaliza telefone: mantém apenas dígitos (igual ao trigger do banco) ──
  // Garante que "(11) 99999-9999" e "11999999999" sejam tratados como iguais.
  const normalizedPhone = (() => {
    if (!phone || typeof phone !== 'string') return null
    const digits = phone.replace(/\D/g, '').slice(0, MAX_FIELD_LEN)
    return digits.length > 0 ? digits : null
  })()

  const leadPayload = {
    tenant_id,
    name:            name.trim().slice(0, MAX_FIELD_LEN),
    phone:           normalizedPhone,
    email:           (email && typeof email === 'string' && email.trim())
                        ? email.trim().slice(0, MAX_FIELD_LEN) : null,
    status:          'active' as const,
    source:          leadSource,
    source_campaign: (source_campaign && typeof source_campaign === 'string')
                        ? source_campaign.trim().slice(0, MAX_FIELD_LEN) : null,
    notes:           (notes && typeof notes === 'string')
                        ? notes.trim().slice(0, MAX_NOTES_LEN) : null,
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

  // ── Adiciona ao pipeline na etapa de entrada ────────────────────────────
  // Só adiciona se pipeline_id foi fornecido E a pipeline tem start_stage_id.
  // Não usa fallback aleatório para evitar leads em pipelines erradas.
  if (pipeline_id && typeof pipeline_id === 'string') {
    try {
      // Resolve start_stage_id da pipeline (garantindo que pertence ao tenant)
      const { data: pipeline } = await supabaseAdmin
        .from('pipelines')
        .select('start_stage_id')
        .eq('id', pipeline_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      const targetStageId = pipeline?.start_stage_id ?? null

      if (!targetStageId) {
        console.warn('[receive-lead] pipeline sem start_stage_id configurado:', pipeline_id)
      } else {
        // Verifica se lead já tem card em qualquer pipeline (UNIQUE lead_id em pipeline_cards)
        const { count: existingCards } = await supabaseAdmin
          .from('pipeline_cards')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', lead.id)

        if (!existingCards || existingCards === 0) {
          // Calcula posição no final da coluna de destino
          const { count: stageCount } = await supabaseAdmin
            .from('pipeline_cards')
            .select('id', { count: 'exact', head: true })
            .eq('stage_id', targetStageId)

          const { error: cardErr } = await supabaseAdmin.from('pipeline_cards').insert({
            tenant_id,
            lead_id:  lead.id,
            stage_id: targetStageId,
            position: stageCount ?? 0,
            moved_at: new Date().toISOString(),
          })

          if (cardErr) {
            console.error('[receive-lead] erro ao criar card na pipeline:', cardErr)
          }
        }
        // Se já tem card, mantém onde está (não move lead que já está em andamento)
      }
    } catch (pipelineErr) {
      console.error('[receive-lead] erro ao processar pipeline:', pipelineErr)
      // Não bloqueia a resposta — o lead já foi criado com sucesso
    }
  }

  return json({
    success: true,
    lead_id: lead.id,
    message: 'Lead criado com sucesso',
  }, 201)
})
