/**
 * Edge Function: telefonia-webhook
 *
 * Recebe o fim de cada chamada e transforma em atividade no lead: resultado,
 * duração e link da gravação.
 *
 * É o que faz a operação passar a ter taxa de atendimento sem depender de
 * ninguém lembrar de marcar nada — que foi exatamente o motivo de 90 dias
 * com zero ligações registradas.
 *
 * A URL carrega o segredo da empresa:
 *   /telefonia-webhook?s=<webhook_secret>
 * O provedor não assina a requisição, então a URL ser impossível de adivinhar
 * é a única prova de origem. Sem isso, qualquer um inventaria chamadas
 * atendidas e a taxa viraria ficção.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Traduz a causa de desligamento pro mesmo vocabulário do registro manual.
 *
 * É o que permite somar ligação registrada na mão com ligação automática no
 * mesmo relatório. Se cada origem falasse um idioma, a taxa de atendimento
 * teria que ser calculada duas vezes e ninguém confiaria em nenhuma.
 */
function traduzirResultado(causa: string | undefined, atendidaEm: string | null | undefined): string {
  if (atendidaEm) return 'atendeu'

  switch ((causa ?? '').toUpperCase()) {
    case 'NO_ANSWER':
    case 'ORIGINATOR_CANCEL':
    case 'ALLOTTED_TIMEOUT':
      return 'nao_atendeu'
    case 'USER_BUSY':
      return 'nao_atendeu'
    case 'UNALLOCATED_NUMBER':
    case 'INVALID_NUMBER_FORMAT':
    case 'NO_ROUTE_DESTINATION':
      return 'numero_errado'
    default:
      return 'nao_atendeu'
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const segredo = new URL(req.url).searchParams.get('s')
  if (!segredo) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: cred } = await admin
    .from('telefonia_credenciais')
    .select('tenant_id, ativo')
    .eq('webhook_secret', segredo)
    .maybeSingle()

  if (!cred?.tenant_id || !cred.ativo) return json({ error: 'unauthorized' }, 401)

  let evento: Record<string, unknown>
  try { evento = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  // Só interessa o fim da chamada: é o único momento em que existem duração,
  // causa e gravação. O evento de atendimento chegaria sem nada disso e
  // criaria uma segunda linha na timeline pro mesmo telefonema.
  if (evento.eventType !== 'channel-hangup') {
    return json({ ok: true, ignorado: evento.eventType })
  }

  const meta = (evento.metadata ?? {}) as Record<string, string>

  // O tenant vem do SEGREDO da URL, não do corpo. Se viesse do corpo, quem
  // descobrisse um segredo poderia gravar chamada na conta de outra empresa.
  if (meta.tenant_id && meta.tenant_id !== cred.tenant_id) {
    return json({ error: 'Empresa não confere' }, 403)
  }

  if (!meta.lead_id) {
    // Chamada feita fora do CRM (discada direto no ramal). Não há lead a
    // quem atribuir; ignorar é melhor que inventar um vínculo.
    return json({ ok: true, ignorado: 'sem lead' })
  }

  const { error } = await admin.rpc('registrar_chamada', {
    p_tenant_id:  cred.tenant_id,
    p_lead_id:    meta.lead_id,
    p_user_id:    meta.user_id ?? null,
    p_resultado:  traduzirResultado(evento.hangupCause as string, evento.answeredAt as string),
    p_duracao:    typeof evento.duration === 'number' ? evento.duration : null,
    p_gravacao:   (evento.recordUrl as string) ?? null,
    p_chamada_id: (evento.id as string) ?? null,
  })

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true })
})
