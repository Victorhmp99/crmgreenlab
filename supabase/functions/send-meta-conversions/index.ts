/**
 * Edge Function: send-meta-conversions
 *
 * Drena a fila `meta_conversion_events` e manda os eventos pra API de
 * Conversões do Meta. Roda de 5 em 5 minutos via pg_cron.
 *
 * Por que fila e não envio no clique: se o Meta estiver fora do ar no momento
 * em que a secretária arrasta o card, o evento não pode sumir. E arrastar card
 * não pode ficar lento nem falhar por causa de uma chamada HTTP externa.
 *
 * ISOLAMENTO: o token e o dataset são lidos SEMPRE a partir do tenant_id
 * gravado na linha da fila — nunca de qualquer coisa vinda de fora. É o mesmo
 * cuidado que faltou uma vez no CRC e fez consulta de uma empresa sair pelo
 * WhatsApp de outra.
 *
 * Chamada: POST com header `x-cron-secret`. O segredo mora no Vault do próprio
 * banco (não em variável de ambiente), então o projeto se configura sozinho —
 * o cron lê pra mandar, a função pergunta ao banco se confere, e não existe
 * cópia do segredo em painel nenhum.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH_VERSION = 'v21.0'
const LOTE_MAXIMO   = 200  // eventos por execução
const MAX_TENTATIVAS = 5   // depois disso o evento é dado como perdido

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** SHA-256 em hex — formato que o Meta exige pra todo dado pessoal. */
async function sha256(valor: string): Promise<string> {
  const bytes = new TextEncoder().encode(valor)
  const hash  = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Telefone no formato do Meta: só dígitos, com código do país, sem "+".
 *
 * Devolve LISTA porque um número pode ter duas formas válidas de busca. Um
 * terço da base estava gravado como celular sem o nono dígito, formato que
 * não casa com ninguém hoje — falha silenciosa, a pior categoria: o evento
 * é aceito pelo Meta e simplesmente não encontra a pessoa.
 */
function normalizarTelefone(bruto: string): string[] {
  let d = bruto.replace(/\D/g, '').replace(/^0+/, '')
  if (d.length < 8) return []

  // Sem país na frente: assume Brasil quando o formato bate com número BR.
  // 11 dígitos = DDD + celular (começa com 9). 10 = DDD + 8 dígitos, que
  // pode ser fixo OU celular antigo — a regra do nono dígito resolve abaixo.
  if (d.length === 11 && /^[1-9][1-9]9/.test(d)) d = `55${d}`
  else if (d.length === 10 && /^[1-9][1-9]/.test(d)) d = `55${d}`

  if (!d.startsWith('55') || d.length < 12 || d.length > 13) {
    // Não dá pra afirmar que é brasileiro. Número incompleto não casa com
    // ninguém e ainda derruba a nota de correspondência — melhor não mandar.
    return d.length >= 11 ? [d] : []
  }

  const ddd = d.slice(2, 4)
  const assinante = d.slice(4)
  if (!/^[1-9][1-9]$/.test(ddd)) return [d]

  // Celular no Brasil tem 9 dígitos e começa com 9. Número de 8 dígitos
  // começando com 6-9 é celular de antes da regra do nono dígito: o número
  // atual daquela pessoa é o mesmo com 9 na frente. Fixo começa com 2-5 e
  // tem 8 dígitos mesmo — não se mexe.
  if (assinante.length === 8 && /^[6-9]/.test(assinante)) {
    // Manda as duas: a versão antiga não é número válido hoje, então não
    // corre risco de casar com outra pessoa, e cobre base gravada no
    // formato velho.
    return [`55${ddd}9${assinante}`, d]
  }
  return [d]
}

function normalizarEmail(bruto: string): string | null {
  const limpo = bruto.trim().toLowerCase()
  return limpo.includes('@') ? limpo : null
}

/** Minusculo, sem pontuacao e sem digito — a regra de nome do Meta. */
function normalizarNome(bruto: string): string {
  return bruto.toLowerCase().replace(/[^a-zÀ-ɏ\s]/gi, '').trim()
}

function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Nome vira duas hashes quando tem acento: com e sem.
 *
 * A correspondencia do Meta e por hash exata, e nao da pra saber de que
 * forma o nome da pessoa foi gravado do lado dele. Mandar as duas variantes
 * cobre os dois casos — o campo aceita lista, e sao formas do MESMO nome, nao
 * pessoas diferentes.
 */
async function hashesDeNome(parte: string): Promise<string[]> {
  const limpo = normalizarNome(parte)
  if (!limpo) return []
  const variantes = new Set([limpo, semAcento(limpo)])
  return Promise.all([...variantes].map(sha256))
}

interface LinhaFila {
  id:         string
  tenant_id:  string
  lead_id:    string
  event_name: string
  event_time: string
  attempts:   number
  leads: { name: string | null; phone: string | null; email: string | null; value: number | null; fbc: string | null; fbp: string | null } | null
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const enviado = req.headers.get('x-cron-secret')
  if (!enviado) return json({ error: 'unauthorized' }, 401)

  const { data: autorizado } = await supabase.rpc('verificar_cron_secret', { p_secret: enviado })
  if (autorizado !== true) return json({ error: 'unauthorized' }, 401)

  // ── 1. Pega o que está pendente ──────────────────────────────────────────
  const { data: fila, error: erroFila } = await supabase
    .from('meta_conversion_events')
    .select('id, tenant_id, lead_id, event_name, event_time, attempts, leads(name, phone, email, value, fbc, fbp)')
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_TENTATIVAS)
    .order('created_at', { ascending: true })
    .limit(LOTE_MAXIMO)

  if (erroFila) return json({ error: erroFila.message }, 500)
  if (!fila?.length) return json({ ok: true, enviados: 0, mensagem: 'fila vazia' })

  const linhas = fila as unknown as LinhaFila[]

  // ── 2. Agrupa por empresa ────────────────────────────────────────────────
  // Cada empresa tem dataset e token próprios; um lote por empresa.
  const porTenant = new Map<string, LinhaFila[]>()
  for (const linha of linhas) {
    const atual = porTenant.get(linha.tenant_id) ?? []
    atual.push(linha)
    porTenant.set(linha.tenant_id, atual)
  }

  // ── 3. Valor real dos Purchase ───────────────────────────────────────────
  // Purchase sem valor faz o Meta otimizar por QUANTIDADE de cliente em vez de
  // receita — ele vai atrás do cliente mais barato, não do melhor. O valor do
  // contrato é a fonte mais confiável; o campo `value` do lead é a estimativa
  // que o vendedor digitou e serve de reserva.
  // Valor fechado por lead. Contrato é a fonte mais confiável: é o que foi
  // assinado, não a estimativa que o vendedor digitou no card.
  const valorPorLead = new Map<string, number>()
  const idsLeads = [...new Set(linhas.map((l) => l.lead_id))]

  if (idsLeads.length) {
    const { data: contratos } = await supabase
      .from('client_contracts')
      .select('lead_id, amount')
      .in('lead_id', idsLeads)
      .in('status', ['active', 'completed', 'upgraded'])

    for (const c of contratos ?? []) {
      const atual = valorPorLead.get(c.lead_id) ?? 0
      valorPorLead.set(c.lead_id, atual + Number(c.amount))
    }
  }

  // ── 4. Envia, empresa por empresa ────────────────────────────────────────
  const resultado = { enviados: 0, falhados: 0, semCredencial: 0, semMatch: 0, erros: [] as string[], respostas: [] as string[] }

  for (const [tenantId, eventos] of porTenant) {
    const { data: cred } = await supabase
      .from('meta_ads_credentials')
      .select('dataset_id, capi_token, capi_test_code, capi_action_source')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!cred?.dataset_id || !cred?.capi_token) {
      // Credencial removida depois de o evento entrar na fila. Não é erro nem
      // vale retentar pra sempre — sai da fila como 'skipped'.
      resultado.semCredencial += eventos.length
      await supabase
        .from('meta_conversion_events')
        .update({ status: 'skipped', last_error: 'empresa sem dataset/token da CAPI' })
        .in('id', eventos.map((e) => e.id))
      continue
    }

    const payload = []
    const semChave: string[] = []

    for (const ev of eventos) {
      // string[] pros campos hasheados (aceitam varias formas do mesmo dado);
      // string simples pra fbc/fbp, que o Meta espera em texto puro.
      const userData: Record<string, string | string[]> = {}

      const tels = ev.leads?.phone ? normalizarTelefone(ev.leads.phone) : []
      if (tels.length) userData.ph = await Promise.all(tels.map(sha256))

      const email = ev.leads?.email ? normalizarEmail(ev.leads.email) : null
      if (email) userData.em = [await sha256(email)]

      // Quanto mais chaves, melhor a correspondencia. So com telefone a nota
      // do Meta fica em 2.5/10; nome e pais sao dados que o CRM ja tem e
      // custam zero pra mandar junto.
      const partes = (ev.leads?.name ?? '').trim().split(/\s+/).filter(Boolean)
      if (partes.length) {
        const fn = await hashesDeNome(partes[0])
        if (fn.length) userData.fn = fn
        if (partes.length > 1) {
          const ln = await hashesDeNome(partes[partes.length - 1])
          if (ln.length) userData.ln = ln
        }
      }

      // Base inteira e brasileira; o Meta usa o pais como desempate quando o
      // telefone ou o nome batem em mais de uma pessoa.
      userData.country = [await sha256('br')]

      // Identificador do clique no anúncio, capturado no formulário do funil.
      // É a chave mais forte que existe: aponta O CLIQUE, então o Meta sabe
      // exatamente quem é, sem probabilidade. Vai em texto puro de propósito —
      // fbc e fbp NÃO são hasheados, ao contrário de todo o resto.
      //
      // Guardado no lead, vale pra todos os eventos dele: o mesmo fbc sai no
      // "agendou" de hoje e no "fechou" daqui a vinte dias.
      if (ev.leads?.fbc) userData.fbc = ev.leads.fbc
      if (ev.leads?.fbp) userData.fbp = ev.leads.fbp

      // Nome e país sozinhos não identificam ninguém. Sem telefone, e-mail
      // NEM identificador de clique, o evento não tem como casar: sai da fila
      // como 'skipped' em vez de ficar sendo retentado pra sempre.
      if (!userData.ph && !userData.em && !userData.fbc) {
        semChave.push(ev.id)
        continue
      }  // sem chave de match, não adianta

      const evento: Record<string, unknown> = {
        event_name:    ev.event_name,
        event_time:    Math.floor(new Date(ev.event_time).getTime() / 1000),
        event_id:      ev.id,               // o Meta usa isso pra não contar duas vezes
        action_source: cred.capi_action_source ?? 'system_generated',  // veio do CRM, não de clique em página
        user_data:     userData,
      }

      // Valor em TODO evento que tiver, não só no fechamento: é assim que o
      // Meta calcula retorno sobre investimento em vez de só contar cabeça.
      // No fechamento vale o contrato (dinheiro real); nas etapas anteriores,
      // o valor estimado do lead, que é o que se sabe naquele momento.
      const contrato = valorPorLead.get(ev.lead_id) ?? 0
      const estimado = Number(ev.leads?.value ?? 0)
      const valor = contrato > 0 ? contrato : estimado

      if (valor > 0) evento.custom_data = { value: valor, currency: 'BRL' }

      payload.push({ linha: ev.id, evento })
    }

    if (semChave.length) {
      resultado.semMatch += semChave.length
      await supabase
        .from('meta_conversion_events')
        .update({ status: 'skipped', last_error: 'lead sem telefone ou e-mail utilizável' })
        .in('id', semChave)
    }

    if (!payload.length) continue

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cred.dataset_id}/events`
    const ids = payload.map((p) => p.linha)

    try {
      const resposta = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data:         payload.map((p) => p.evento),
          access_token: cred.capi_token,
          // Enquanto a empresa tiver um código de teste salvo, o evento
          // também aparece na aba "Eventos de teste" do Meta, na hora. É o
          // único jeito de conferir sem esperar a indexação da visão geral.
          ...(cred.capi_test_code ? { test_event_code: cred.capi_test_code } : {}),
        }),
      })

      const corpo = await resposta.text()

      if (resposta.ok) {
        // Guarda o corpo mesmo no sucesso: HTTP 200 não garante que o Meta
        // contou o evento. É aqui que vem events_received (pode ser 0) e os
        // avisos em `messages` — sem isso, "enviado" é suposição.
        resultado.enviados += ids.length
        resultado.respostas.push(corpo.slice(0, 300))
        await supabase
          .from('meta_conversion_events')
          .update({
            status: 'sent', sent_at: new Date().toISOString(),
            last_error: null, last_response: corpo.slice(0, 1000),
          })
          .in('id', ids)
      } else {
        // O motivo real (token expirado, dataset errado, sem permissão) vem no
        // corpo. Guardar só "deu ruim" deixaria a pessoa sem saber o que
        // corrigir — foi exatamente o que aconteceu no sync de campanhas.
        resultado.falhados += ids.length
        resultado.erros.push(`${tenantId}: ${corpo.slice(0, 300)}`)
        await marcarFalha(supabase, eventos, corpo.slice(0, 500))
      }
    } catch (e) {
      resultado.falhados += ids.length
      const msg = e instanceof Error ? e.message : String(e)
      resultado.erros.push(`${tenantId}: ${msg}`)
      await marcarFalha(supabase, eventos, msg.slice(0, 500))
    }
  }

  return json({ ok: true, ...resultado })
})

/** Marca falha preservando a contagem individual de tentativas de cada linha. */
async function marcarFalha(
  supabase: ReturnType<typeof createClient>,
  eventos: LinhaFila[],
  erro: string,
) {
  await Promise.all(eventos.map((ev) =>
    supabase
      .from('meta_conversion_events')
      .update({ status: 'failed', attempts: ev.attempts + 1, last_error: erro })
      .eq('id', ev.id),
  ))
}
