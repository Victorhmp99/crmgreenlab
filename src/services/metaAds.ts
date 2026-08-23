import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MetaCredentials {
  /** Se já existe token salvo. O token em si NUNCA vem pro navegador. */
  hasToken:     boolean
  syncedAt:     string | null
  /** Dataset (pixel) que recebe os eventos da API de Conversões. */
  datasetId:    string | null
  /** Idem: só informamos se existe, o token nunca desce. */
  hasCapiToken: boolean
  /** Código da aba "Eventos de teste". Não é segredo — pode vir pra tela. */
  capiTestCode: string | null
}

/**
 * Conta de anúncio. Uma empresa pode ter várias — o mesmo token do usuário do
 * sistema enxerga todas as contas atribuídas a ele como ativo.
 */
export interface MetaAdAccount {
  id:            string
  tenant_id:     string
  ad_account_id: string
  label:         string | null
  active:        boolean
  created_at:    string
}

export async function fetchAdAccounts(tenantId: string): Promise<MetaAdAccount[]> {
  const { data, error } = await supabase
    .from('meta_ad_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at')

  if (error) throw error
  return data ?? []
}

export async function addAdAccount(
  tenantId: string, adAccountId: string, label?: string,
): Promise<void> {
  const id = adAccountId.trim()
  const { error } = await supabase.from('meta_ad_accounts').insert({
    tenant_id:     tenantId,
    ad_account_id: id.startsWith('act_') ? id : `act_${id}`,
    label:         label?.trim() || null,
  })
  if (error) {
    // 23505 = unique violation (tenant_id, ad_account_id)
    if (error.code === '23505') throw new Error('Essa conta já está cadastrada.')
    throw error
  }
}

export async function removeAdAccount(id: string): Promise<void> {
  const { error } = await supabase.from('meta_ad_accounts').delete().eq('id', id)
  if (error) throw error
}

export async function toggleAdAccount(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('meta_ad_accounts').update({ active }).eq('id', id)
  if (error) throw error
}

/** Períodos aceitos pela sincronização (espelha o allowlist da Edge Function). */
export const DATE_PRESETS = [
  { value: 'today',      label: 'Hoje' },
  { value: 'yesterday',  label: 'Ontem' },
  { value: 'last_7d',    label: 'Últimos 7 dias' },
  { value: 'last_14d',   label: 'Últimos 14 dias' },
  { value: 'last_30d',   label: 'Últimos 30 dias' },
  { value: 'last_90d',   label: 'Últimos 90 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'maximum',    label: 'Máximo' },
] as const

export type DatePreset = typeof DATE_PRESETS[number]['value']

export function presetLabel(value: string | null | undefined): string {
  return DATE_PRESETS.find((p) => p.value === value)?.label ?? 'Últimos 30 dias'
}

export interface Campaign {
  id:             string
  tenant_id:      string
  external_id:    string
  /** De qual conta de anúncio veio (act_...). Null em dados sincronizados
   *  antes do suporte a várias contas. */
  ad_account_id:  string | null
  name:           string
  platform:       string
  status:         string | null
  objective:      string | null
  spend:          number | null
  impressions:    number | null
  clicks:         number | null
  reach:          number | null
  frequency:      number | null
  ctr:            number | null
  cpc:            number | null
  cpm:            number | null
  leads_generated: number | null
  conversations:  number | null
  purchases:      number | null
  date_preset:    string | null
  synced_at:      string
  /** Custo por lead — considera lead de formulário OU conversa iniciada. */
  cpl?:           number | null
  /** Total de "resultados" (leads + conversas), que é o que interessa comparar. */
  results?:       number
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
    .select('synced_at, access_token, dataset_id, capi_token, capi_test_code')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return null

  return {
    hasToken:     !!data.access_token,
    syncedAt:     data.synced_at,
    datasetId:    data.dataset_id ?? null,
    hasCapiToken: !!data.capi_token,
    capiTestCode: data.capi_test_code ?? null,
  }
}

/** Salva/atualiza só o token da empresa. As contas ficam em meta_ad_accounts. */
export async function saveMetaToken(tenantId: string, accessToken: string): Promise<void> {
  const { error } = await supabase
    .from('meta_ads_credentials')
    .upsert(
      { tenant_id: tenantId, access_token: accessToken.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id' },
    )

  if (error) throw error
}

// ── API de Conversões ─────────────────────────────────────────────────────────

/**
 * Sugestões de evento. O nome final é livre — o campo aceita qualquer nome
 * válido pro Meta, porque o pixel da empresa pode já ter evento com o mesmo
 * sentido vindo de outra origem (Calendly, formulário) e aí convém um nome
 * que deixe claro que veio do comercial.
 *
 * `Purchase` é o único que vale manter com o nome padrão mesmo assim: é ele
 * que o Meta liga a valor e ROAS no relatório de campanha. Nome próprio ali
 * custa esse relatório.
 */
export const META_EVENTS = [
  { value: 'Purchase', label: 'Fechou',           descricao: 'Virou cliente — leva o valor junto. Mantenha este nome: é o que dá ROAS no relatório' },
  { value: 'Lead',     label: 'Lead qualificado', descricao: 'Respondeu e tem perfil' },
  { value: 'Schedule', label: 'Agendou',          descricao: 'Marcou consulta ou reunião' },
] as const

export type MetaEvent = string

/** Regra de nome do Meta: letra no início, depois letra/número/_/-, até 40. */
export const META_EVENT_REGEX = /^[A-Za-z][A-Za-z0-9_-]{1,39}$/

export function metaEventLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return META_EVENTS.find((e) => e.value === value)?.label ?? value
}

/** Se o nome não é um dos padrão — usado pra explicar o custo do personalizado. */
export function isEventoPersonalizado(value: string | null | undefined): boolean {
  return !!value && !META_EVENTS.some((e) => e.value === value)
}

/**
 * Salva dataset e token da API de Conversões.
 *
 * Token em branco mantém o que já está salvo — mesma regra do token de
 * leitura. Como ele nunca desce pro navegador, campo vazio significa "não
 * mexi nisso", não "apague".
 */
export async function saveCapiConfig(
  tenantId:  string,
  datasetId: string,
  capiToken?: string,
  testCode?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    tenant_id:      tenantId,
    dataset_id:     datasetId.trim() || null,
    // Vazio LIMPA de propósito, ao contrário do token: código de teste
    // esquecido ligado é pior que ausente — o Meta passa a tratar tudo como
    // teste e os eventos param de contar pra valer.
    capi_test_code: testCode?.trim() || null,
    updated_at:     new Date().toISOString(),
  }
  if (capiToken?.trim()) payload.capi_token = capiToken.trim()

  const { error } = await supabase
    .from('meta_ads_credentials')
    .upsert(payload, { onConflict: 'tenant_id' })

  if (error) throw error

  // Credencial errada é a causa mais comum de falha, e o unique da fila
  // impede que o evento daquele lead seja gerado de novo. Salvar credencial
  // nova é justamente o momento em que a causa costuma ter sido resolvida,
  // então devolvemos os falhos pra fila junto — senão os leads que falharam
  // durante o teste ficariam queimados pra sempre.
  await supabase.rpc('reenfileirar_eventos_meta', { p_tenant_id: tenantId })
}

/**
 * Dispara a fila na hora, sem esperar os 5 minutos do cron.
 *
 * Existe pro momento da configuração: esperar sem saber se vai funcionar faz
 * a pessoa achar que quebrou. Na operação normal ninguém precisa disso.
 */
export async function enviarEventosAgora(tenantId: string): Promise<number> {
  const { data, error } = await supabase.rpc('enviar_eventos_meta_agora', { p_tenant_id: tenantId })
  if (error) throw error
  return (data as number) ?? 0
}

/** Devolve pra fila tudo que falhou. Usado pelo botão "tentar de novo". */
export async function reenfileirarEventos(tenantId: string): Promise<number> {
  const { data, error } = await supabase.rpc('reenfileirar_eventos_meta', { p_tenant_id: tenantId })
  if (error) throw error
  return (data as number) ?? 0
}

/** Desliga o envio sem apagar o token de leitura de campanhas. */
export async function disableCapi(tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('meta_ads_credentials')
    .update({ dataset_id: null, capi_token: null, capi_test_code: null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)

  if (error) throw error
}

export interface ConversionStats {
  enviados:  number
  pendentes: number
  falhados:  number
  /** Motivo da última falha — é o que diz o que corrigir (token, dataset). */
  ultimoErro: string | null
}

export async function fetchConversionStats(tenantId: string): Promise<ConversionStats> {
  const { data, error } = await supabase
    .from('meta_conversion_events')
    .select('status, last_error, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error

  const linhas = data ?? []
  return {
    enviados:  linhas.filter((l) => l.status === 'sent').length,
    pendentes: linhas.filter((l) => l.status === 'pending').length,
    falhados:  linhas.filter((l) => l.status === 'failed').length,
    ultimoErro: linhas.find((l) => l.status === 'failed')?.last_error ?? null,
  }
}

export interface FunilParaMapear {
  pipelineId:   string
  pipelineName: string
  stages: Array<{ id: string; name: string; position: number; meta_event: string | null }>
}

/**
 * Colunas da empresa agrupadas por funil, pra montar o mapa coluna → evento.
 *
 * Agrupado por funil porque uma empresa pode ter vários e as colunas se
 * repetem entre eles ("Agendado" existe em seis funis da Green Hub) — sem o
 * nome do funil ao lado não dá pra saber qual "Agendado" se está marcando.
 */
export async function fetchFunisParaMapear(tenantId: string): Promise<FunilParaMapear[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    // A FK precisa ser nomeada: existem DUAS ligações entre pipeline_stages e
    // pipelines (o funil da coluna, e a coluna inicial do funil). Sem
    // qualificar, o PostgREST recusa a consulta por ambiguidade (PGRST201).
    .select('id, name, position, meta_event, pipeline_id, pipelines!pipeline_stages_pipeline_id_fkey(name)')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (error) throw error

  const mapa = new Map<string, FunilParaMapear>()
  for (const row of data ?? []) {
    const pid = row.pipeline_id as string
    if (!pid) continue
    const nome = (row.pipelines as unknown as { name: string } | null)?.name ?? 'Funil'
    const funil = mapa.get(pid) ?? { pipelineId: pid, pipelineName: nome, stages: [] }
    funil.stages.push({
      id: row.id, name: row.name, position: row.position, meta_event: row.meta_event,
    })
    mapa.set(pid, funil)
  }

  return [...mapa.values()].sort((a, b) => a.pipelineName.localeCompare(b.pipelineName))
}

/** Liga (ou desliga, com null) o evento que uma coluna do funil dispara. */
export async function updateStageMetaEvent(
  stageId: string,
  event:   MetaEvent | null,
): Promise<void> {
  const { error } = await supabase
    .from('pipeline_stages')
    .update({ meta_event: event })
    .eq('id', stageId)

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

  return (data ?? []).map((row) => {
    const spend = row.spend != null ? Number(row.spend) : null
    // "Resultado" depende do objetivo: campanha de formulário gera lead,
    // campanha de WhatsApp/Direct gera conversa. Somamos os dois pra poder
    // comparar campanhas de objetivos diferentes na mesma tabela.
    const results = (row.leads_generated ?? 0) + (row.conversations ?? 0)
    return {
      ...row,
      spend,
      frequency: row.frequency != null ? Number(row.frequency) : null,
      ctr:       row.ctr       != null ? Number(row.ctr)       : null,
      cpc:       row.cpc       != null ? Number(row.cpc)       : null,
      cpm:       row.cpm       != null ? Number(row.cpm)       : null,
      results,
      cpl: spend && results > 0 ? spend / results : null,
    }
  }) as Campaign[]
}

// ── Sincronizar via Edge Function ─────────────────────────────────────────────
// A Edge Function "sync-meta-ads" (publicada no Supabase) é quem fala com a
// Meta Graph API. O token fica só nela — nunca passa pelo navegador.

export async function syncMetaAds(
  tenantId: string,
  datePreset: DatePreset = 'last_30d',
  /** Omitido = sincroniza todas as contas ativas da empresa. */
  adAccountId?: string,
): Promise<{ synced: number }> {
  const { data, error } = await supabase.functions.invoke('sync-meta-ads', {
    body: {
      tenant_id: tenantId,
      date_preset: datePreset,
      ...(adAccountId ? { ad_account_id: adAccountId } : {}),
    },
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
