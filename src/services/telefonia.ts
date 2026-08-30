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

/** Ramal de cada pessoa da empresa — é o que permite ela discar. */
export async function salvarRamal(membershipId: string, ramal: string): Promise<void> {
  const { error } = await supabase
    .from('user_memberships')
    .update({ ramal: ramal.trim() || null })
    .eq('id', membershipId)

  if (error) throw error
}

export interface ResultadoDiscagem {
  ok:      boolean
  erro?:   string
  detalhe?: string
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
  const { data, error } = await supabase.functions.invoke('telefonia-discar', {
    body: { tenant_id: tenantId, lead_id: leadId, telefone },
  })

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
