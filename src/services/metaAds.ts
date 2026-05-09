import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MetaCredentials {
  appId:        string
  accessToken:  string
  adAccountId:  string
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

export async function fetchMetaCredentials(tenantId: string): Promise<MetaCredentials | null> {
  const { data, error } = await supabase
    .from('meta_ads_credentials')
    .select('app_id, access_token, ad_account_id, synced_at')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) return null

  return {
    appId:       data.app_id,
    accessToken: data.access_token,
    adAccountId: data.ad_account_id,
    syncedAt:    data.synced_at,
  }
}

export async function saveMetaCredentials(
  tenantId:     string,
  credentials:  Omit<MetaCredentials, 'syncedAt'>,
): Promise<void> {
  const { error } = await supabase
    .from('meta_ads_credentials')
    .upsert({
      tenant_id:     tenantId,
      app_id:        credentials.appId,
      access_token:  credentials.accessToken,
      ad_account_id: credentials.adAccountId,
      updated_at:    new Date().toISOString(),
    })

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
// A Edge Function "sync-meta-ads" faz a chamada real à Meta Graph API
// e popula a tabela campaigns. Precisa ser deployada separadamente.

export async function syncMetaAds(tenantId: string): Promise<{ synced: number }> {
  const { data, error } = await supabase.functions.invoke('sync-meta-ads', {
    body: { tenant_id: tenantId },
  })

  if (error) throw new Error(error.message ?? 'Erro na sincronização')
  return { synced: data?.synced ?? 0 }
}

// ── Edge Function stub (supabase/functions/sync-meta-ads/index.ts) ────────────
// Criada automaticamente como arquivo de referência

export const EDGE_FUNCTION_STUB = `
// supabase/functions/sync-meta-ads/index.ts
// Deploy: supabase functions deploy sync-meta-ads

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { tenant_id } = await req.json()

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 1. Busca credenciais do tenant
  const { data: creds } = await supabase
    .from("meta_ads_credentials")
    .select("*")
    .eq("tenant_id", tenant_id)
    .single()

  if (!creds) return new Response(JSON.stringify({ error: "No credentials" }), { status: 400 })

  // 2. Chama Meta Graph API
  const url = \`https://graph.facebook.com/v18.0/\${creds.ad_account_id}/campaigns\`
    + \`?fields=id,name,status,insights{spend,impressions,clicks,leads}&access_token=\${creds.access_token}\`

  const res  = await fetch(url)
  const json = await res.json()
  const campaigns = json.data ?? []

  // 3. Upsert na tabela campaigns
  let synced = 0
  for (const c of campaigns) {
    const insights = c.insights?.data?.[0] ?? {}
    await supabase.from("campaigns").upsert({
      tenant_id,
      external_id:     c.id,
      name:            c.name,
      platform:        "meta",
      status:          c.status,
      spend:           insights.spend ? parseFloat(insights.spend) : null,
      impressions:     insights.impressions ? parseInt(insights.impressions) : null,
      clicks:          insights.clicks ? parseInt(insights.clicks) : null,
      leads_generated: insights.leads ?? null,
      synced_at:       new Date().toISOString(),
    })
    synced++
  }

  // 4. Atualiza synced_at nas credenciais
  await supabase.from("meta_ads_credentials")
    .update({ synced_at: new Date().toISOString() })
    .eq("tenant_id", tenant_id)

  return new Response(JSON.stringify({ synced }), { status: 200 })
})
`
