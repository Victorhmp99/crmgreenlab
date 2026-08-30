import { supabase } from '@/lib/supabase'

/**
 * Telefonia integrada ao CRM.
 *
 * O disparo passa por Edge Function e não pelo navegador: o token da empresa
 * não pode descer pro cliente. E o ramal de quem liga vem do banco, nunca do
 * que o navegador manda — senão daria pra ligar usando o ramal de outra
 * pessoa e sujar o registro dela.
 */

export interface TelefoniaConfig {
  /** O token nunca desce pro navegador; só informamos se existe. */
  hasToken:     boolean
  ativo:        boolean
  /** Vai na URL que o provedor chama. Não é segredo de acesso ao CRM. */
  webhookSecret: string | null
}

export async function fetchTelefoniaConfig(tenantId: string): Promise<TelefoniaConfig | null> {
  const { data, error } = await supabase
    .from('telefonia_credenciais')
    .select('token, ativo, webhook_secret')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return null

  return {
    hasToken:      !!data.token,
    ativo:         data.ativo,
    webhookSecret: data.webhook_secret,
  }
}

/** Token em branco mantém o salvo — mesma regra dos outros tokens do sistema. */
export async function salvarTelefoniaConfig(
  tenantId: string,
  token?:   string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    tenant_id:  tenantId,
    ativo:      true,
    updated_at: new Date().toISOString(),
  }
  if (token?.trim()) payload.token = token.trim()

  const { error } = await supabase
    .from('telefonia_credenciais')
    .upsert(payload, { onConflict: 'tenant_id' })

  if (error) throw error
}

export async function desligarTelefonia(tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('telefonia_credenciais')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)

  if (error) throw error
}

/**
 * Ramal de cada pessoa da empresa — é o que permite ela discar.
 *
 * Vai por RPC: a tabela de vínculos só aceita escrita de admin, então o
 * gestor receberia sucesso com zero linhas alteradas e o campo voltaria
 * vazio sem erro nenhum.
 */
export async function salvarRamal(membershipId: string, ramal: string): Promise<void> {
  const { error } = await supabase.rpc('definir_ramal', {
    p_membership_id: membershipId,
    p_ramal:         ramal,
  })

  if (error) throw error
}

export interface ResultadoDiscagem {
  ok:      boolean
  erro?:   string
  detalhe?: string
}

/**
 * Renova o token do login antes de discar, se ele estiver perto de vencer.
 *
 * Discar é a única ação do CRM que a pessoa dispara DEPOIS de sair da aba:
 * ela vai pro softphone, atende, volta e clica de novo. Nesse intervalo o
 * navegador suspende o temporizador que renova o token, e o clique seguinte
 * sai com credencial vencida — a função devolve 401 e a tela acusa "Sessão
 * inválida", como se o login tivesse caído. Não caiu; só não foi renovado a
 * tempo, e reclamar de sessão manda a pessoa fazer login à toa.
 */
async function garantirSessao(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // Com folga: token que vence em 30s vence no meio da requisição.
  const faltam = (session.expires_at ?? 0) * 1000 - Date.now()
  if (faltam < 60_000) await supabase.auth.refreshSession()
}

/**
 * Dispara a ligação. O provedor toca PRIMEIRO no ramal do vendedor e só
 * depois disca pro cliente — então ele precisa estar com o webphone aberto.
 */
export async function discar(
  tenantId: string,
  leadId:   string,
  telefone: string,
): Promise<ResultadoDiscagem> {
  await garantirSessao()

  const corpo = { tenant_id: tenantId, lead_id: leadId, telefone }
  let { data, error } = await supabase.functions.invoke('telefonia-discar', { body: corpo })

  // 401 mesmo depois da renovação preventiva: o token venceu entre a checagem
  // e o envio. Renova de fato e tenta uma vez — é exatamente o que a pessoa
  // faria clicando de novo, e ela não deveria precisar descobrir isso sozinha.
  const ctxStatus = (error as { context?: Response } | null)?.context?.status
  if (ctxStatus === 401) {
    await supabase.auth.refreshSession()
    ;({ data, error } = await supabase.functions.invoke('telefonia-discar', { body: corpo }))
  }

  if (error) {
    // O invoke devolve só "non-2xx status code"; o motivo real está no corpo
    // e é o que diz se foi ramal, crédito ou token. Sem ler isso, o vendedor
    // fica sem saber o que corrigir — e foi o que aconteceu na primeira
    // tentativa real: apareceu "não foi possível" sem dizer nada.
    let detalhe = ''
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const corpo = await ctx.clone().json().catch(() => null)
        detalhe = corpo?.detalhe
          ? `${corpo.error ?? 'Erro'}: ${corpo.detalhe}`
          : (corpo?.error ?? await ctx.clone().text().catch(() => ''))
      }
    } catch { /* corpo ilegível */ }

    // Quando nem o corpo veio, o problema costuma ser antes do servidor
    // (rede ou navegador bloqueando), e dizer isso ajuda mais que "falhou".
    return {
      ok:   false,
      erro: detalhe
        || `Não foi possível iniciar a ligação. A requisição não chegou ao servidor — verifique sua conexão. (${error.message})`,
    }
  }

  if ((data as ResultadoDiscagem)?.ok === false) return data as ResultadoDiscagem
  return { ok: true }
}
