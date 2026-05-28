/**
 * Edge Function: receive-whatsapp
 *
 * Recebe webhooks da Evolution API quando uma nova mensagem chega no WhatsApp
 * conectado a um tenant. Auto-cria lead (se não existir) e loga atividade.
 *
 * Endpoint: POST /functions/v1/receive-whatsapp/<webhook_token>
 *
 * O webhook_token identifica o tenant. Cada tenant tem seu próprio.
 * Configurar no Evolution apontando webhook pra essa URL.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

interface EvolutionPayload {
  event?:    string
  instance?: string
  data?: {
    key?: {
      remoteJid?: string
      fromMe?:    boolean
      id?:        string
    }
    pushName?: string
    message?: {
      conversation?:        string
      extendedTextMessage?: { text?: string }
      imageMessage?:        { caption?: string }
      videoMessage?:        { caption?: string }
      audioMessage?:        unknown
      documentMessage?:     { fileName?: string }
    }
    messageType?:      string
    messageTimestamp?: number
  }
}

/** Extrai o texto/legenda da mensagem (suporta texto, imagem, vídeo, áudio, doc) */
function extractMessageContent(msg: EvolutionPayload['data']): { text: string; kind: string } {
  if (!msg?.message) return { text: '', kind: 'unknown' }
  const m = msg.message

  if (m.conversation)               return { text: m.conversation, kind: 'text' }
  if (m.extendedTextMessage?.text)  return { text: m.extendedTextMessage.text, kind: 'text' }
  if (m.imageMessage)               return { text: m.imageMessage.caption ?? '[Imagem]', kind: 'image' }
  if (m.videoMessage)               return { text: m.videoMessage.caption ?? '[Vídeo]', kind: 'video' }
  if (m.audioMessage)               return { text: '[Áudio]', kind: 'audio' }
  if (m.documentMessage)            return { text: `[Documento: ${m.documentMessage.fileName ?? 'sem nome'}]`, kind: 'document' }

  return { text: '[Mensagem não suportada]', kind: msg.messageType ?? 'unknown' }
}

/** remoteJid '5511999999999@s.whatsapp.net' → '5511999999999' */
function extractPhone(remoteJid: string | undefined): string | null {
  if (!remoteJid) return null
  // Ignora grupos (@g.us) e canais especiais
  if (remoteJid.endsWith('@g.us')) return null
  if (remoteJid.endsWith('@broadcast')) return null
  return remoteJid.split('@')[0] || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Extrai token do path ────────────────────────────────────────────────
  const url   = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const token = parts[parts.length - 1]

  // UUID v4 básico: 36 chars com hífens
  if (!token || token.length !== 36) {
    return json({ error: 'Webhook token ausente ou inválido na URL' }, 400)
  }

  // ── Parse payload ───────────────────────────────────────────────────────
  let payload: EvolutionPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  // Só processa mensagens recebidas (não enviadas pela empresa)
  if (payload.data?.key?.fromMe === true) {
    return json({ skipped: true, reason: 'fromMe' }, 200)
  }

  const phone = extractPhone(payload.data?.key?.remoteJid)
  if (!phone) {
    return json({ skipped: true, reason: 'phone ausente ou grupo' }, 200)
  }

  // ── Supabase admin client ───────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // ── Identifica tenant pelo token ────────────────────────────────────────
  const { data: settings, error: settingsErr } = await supabase
    .from('whatsapp_settings')
    .select('tenant_id, active, default_stage_id, default_channel_id, pipeline_id')
    .eq('webhook_token', token)
    .maybeSingle()

  if (settingsErr) {
    console.error('[whatsapp] settings error:', settingsErr)
    return json({ error: 'Erro ao identificar tenant' }, 500)
  }

  if (!settings) return json({ error: 'Token inválido' }, 401)
  if (!settings.active) return json({ skipped: true, reason: 'whatsapp desativado' }, 200)

  const tenantId   = settings.tenant_id as string
  const messageId  = payload.data?.key?.id ?? null
  const pushName   = payload.data?.pushName ?? ''

  // ── Resolve a etapa de destino via pipeline_id.start_stage_id ───────────
  let resolvedStageId: string | null = settings.default_stage_id ?? null

  if (settings.pipeline_id) {
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('start_stage_id')
      .eq('id', settings.pipeline_id)
      .maybeSingle()

    if (pipeline?.start_stage_id) {
      resolvedStageId = pipeline.start_stage_id
    }
  }

  // ── Dedupe por messageId ───────────────────────────────────────────────
  if (messageId) {
    const { data: existing } = await supabase
      .from('lead_activities')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('external_id', messageId)
      .maybeSingle()
    if (existing) {
      return json({ skipped: true, reason: 'message already processed' }, 200)
    }
  }

  // ── Match ou cria lead ─────────────────────────────────────────────────
  const { data: leadResult, error: leadErr } = await supabase.rpc('match_or_create_lead_by_phone', {
    p_tenant_id:   tenantId,
    p_phone:       phone,
    p_name:        pushName,
    p_channel_id:  settings.default_channel_id,
    p_stage_id:    resolvedStageId,
    p_pipeline_id: settings.pipeline_id ?? null,
  })

  if (leadErr) {
    console.error('[whatsapp] match_or_create error:', leadErr)
    return json({ error: 'Erro ao processar lead', details: leadErr.message }, 500)
  }

  const leadId = leadResult?.lead_id
  const isNew  = leadResult?.is_new ?? false

  if (!leadId) {
    return json({ error: 'Não foi possível obter lead_id' }, 500)
  }

  // ── Loga atividade ──────────────────────────────────────────────────────
  const { text, kind } = extractMessageContent(payload.data)

  await supabase.from('lead_activities').insert({
    tenant_id:   tenantId,
    lead_id:     leadId,
    user_id:     null,
    type:        'whatsapp',
    description: text.slice(0, 2000),
    external_id: messageId,
    metadata: {
      push_name:    pushName,
      message_type: kind,
      timestamp:    payload.data?.messageTimestamp,
      raw_event:    payload.event,
      instance:     payload.instance,
    },
  })

  return json({
    success:  true,
    lead_id:  leadId,
    is_new:   isNew,
    message:  isNew ? 'Lead criado e mensagem registrada' : 'Mensagem registrada em lead existente',
  }, 200)
})
