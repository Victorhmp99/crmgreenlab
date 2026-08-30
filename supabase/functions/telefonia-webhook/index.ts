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

/**
 * Onde procurar, no evento, o número discado e o ramal de quem discou.
 *
 * A documentação descreve o webhook das chamadas criadas pela API, em que o
 * vínculo com o lead vem pronto no metadata. O formato das chamadas discadas
 * no próprio aparelho não está documentado. Em vez de fixar um nome de campo e
 * falhar calado quando ele não existir, tentamos os candidatos e registramos
 * as chaves recebidas quando nenhum serve — assim o primeiro evento real
 * revela o formato em vez de sumir sem deixar rastro.
 */
const CAMPOS_NUMERO = [
  'destination', 'destinationNumber', 'dialedNumber', 'calledNumber',
  'callee', 'to', 'phone', 'number',
]
const CAMPOS_RAMAL = ['extension', 'ramal', 'caller', 'callerNumber', 'from', 'source']

function primeiroPreenchido(evento: Record<string, unknown>, chaves: string[]): string | null {
  for (const chave of chaves) {
    const valor = evento[chave]
    if (typeof valor === 'string' && valor.trim()) return valor.trim()
    if (typeof valor === 'number') return String(valor)
  }
  return null
}

/**
 * Chamada que não nasceu no CRM: alguém digitou o número no aplicativo SIP.
 *
 * Sem metadata não há lead indicado, mas o número discado costuma ser de um
 * lead que já existe — e essa é justamente a ligação que hoje some do
 * histórico e da taxa de atendimento. O banco resolve o cruzamento; aqui só
 * extraímos o que ele precisa.
 */
async function registrarDoRamal(
  admin:    ReturnType<typeof createClient>,
  tenantId: string,
  evento:   Record<string, unknown>,
): Promise<Response> {
  const numero = primeiroPreenchido(evento, CAMPOS_NUMERO)
  const ramal  = primeiroPreenchido(evento, CAMPOS_RAMAL)

  if (!numero) {
    // Só as CHAVES, nunca os valores: o corpo carrega telefone de cliente, e
    // log não é lugar de dado pessoal.
    console.log('hangup sem lead e sem número reconhecível; chaves:', Object.keys(evento).join(','))
    return json({ ok: true, ignorado: 'sem lead' })
  }

  const { data: leadId, error } = await admin.rpc('registrar_chamada_do_ramal', {
    p_tenant_id:  tenantId,
    p_telefone:   numero,
    p_ramal:      ramal,
    p_resultado:  traduzirResultado(evento.hangupCause as string, evento.answeredAt as string),
    p_duracao:    typeof evento.duration === 'number' ? evento.duration : null,
    p_gravacao:   (evento.recordUrl as string) ?? null,
    p_chamada_id: (evento.id as string) ?? null,
  })

  if (error) return json({ error: error.message }, 500)

  // Número que não é de nenhum lead é normal: ligação pessoal, fornecedor,
  // engano. Inventar um lead pra ela sujaria a base.
  if (!leadId) return json({ ok: true, ignorado: 'número não corresponde a nenhum lead' })

  return json({ ok: true, lead_id: leadId, origem: 'ramal' })
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

  // Discada no aparelho, fora do CRM: não veio lead indicado, mas dá pra
  // descobrir pelo número. Antes isto era descartado e a ligação sumia.
  if (!meta.lead_id) {
    return await registrarDoRamal(admin, cred.tenant_id, evento)
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
