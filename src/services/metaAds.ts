import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MetaCredentials {
  adAccountId:  string
  /** Se já existe token salvo. O token em si NUNCA vem pro navegador. */
  hasToken:     boolean
  syncedAt:     string | null
}

export interface Campaign {
  id:             string
  tenant_id:      string
  external_id:    string
  name:           string
  platform:       string
  status:         string | null
  spend:          number | null
  impressions:    number | null
  clicks:         number | null
  leads_generated: number | null
  synced_at:      string
  cpl?:           number | null   // custo por lead, calculado
}

// ── Credenciais ───────────────────────────────────────────────────────────────

/**
 * Lê a configuração do Meta Ads da empresa. De propósito NÃO seleciona
 * access_token: segredo não precisa trafegar até o navegador — só quem usa
 * é a Edge Function, no servidor. Aqui devolvemos apenas se já existe.
 */
export async function fetchMetaCredentials(tenantId: string): Promise<MetaCredentials | null> {
  const { data, error } = await supabase
    .from('meta_ads_credentials')
    .select('ad_account_id, synced_at, access_token')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return null

  return {
    adAccountId: data.ad_account_id,
    hasToken:    !!data.access_token,
    syncedAt:    data.synced_at,
  }
}

export interface SaveMetaCredentialsData {
  adAccountId:  string
  /** Vazio = mantém o token que já está salvo (não sobrescreve com nada). */
  accessToken?: string
}

export async function saveMetaCredentials(
  tenantId: string,
  data:     SaveMetaCredentialsData,
): Promise<void> {
  const payload: Record<string, unknown> = {
    tenant_id:     tenantId,
    ad_account_id: data.adAccountId.trim(),
    updated_at:    new Date().toISOString(),
  }
  if (data.accessToken?.trim()) payload.access_token = data.accessToken.trim()

  const { error } = await supabase
    .from('meta_ads_credentials')
    .upsert(payload, { onConflict: 'tenant_id' })

  if (error) throw error
}

export async function deleteMetaCredentials(tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('meta_ads_credentials')
    .delete()
    .eq('tenant_id', tenantId)

  if (error) throw error
}

// ── Campanhas ─────────────────────────────────────────────────────────────────

export async function fetchCampaigns(tenantId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('synced_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    ...row,
    spend:          row.spend          ? Number(row.spend)  : null,
    leads_generated: row.leads_generated ?? null,
    // CPL = spend / leads (se disponíveis)
    cpl: row.spend && row.leads_generated && row.leads_generated > 0
      ? Number(row.spend) / row.leads_generated
      : null,
  })) as Campaign[]
}

// ── Sincronizar via Edge Function ─────────────────────────────────────────────
// A Edge Function "sync-meta-ads" (publicada no Supabase) é quem fala com a
// Meta Graph API. O token fica só nela — nunca passa pelo navegador.

export async function syncMetaAds(tenantId: string): Promise<{ synced: number }> {
  const { data, error } = await supabase.functions.invoke('sync-meta-ads', {
    body: { tenant_id: tenantId },
  })

  if (error) {
    // Em resposta não-2xx o supabase-js entrega só "non-2xx status code" e
    // guarda a resposta real em error.context. O motivo acionável (token
    // expirado, conta errada, sem permissão) está no corpo — sem isso a
    // pessoa não sabe o que corrigir.
    let detail = ''
    const ctx = (error as unknown as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { detail = (await ctx.json())?.error ?? '' } catch { /* corpo não-JSON */ }
    }
    throw new Error(detail || error.message || 'Erro na sincronização')
  }

  if (data?.error) throw new Error(data.error)
  return { synced: data?.synced ?? 0 }
}
