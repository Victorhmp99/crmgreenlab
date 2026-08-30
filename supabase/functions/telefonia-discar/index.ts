/**
 * Edge Function: telefonia-discar
 *
 * Dispara uma ligação a partir do CRM. O provedor toca primeiro no ramal do
 * vendedor e só depois disca pro cliente.
 *
 * Roda no servidor por um motivo só: o token da empresa não pode ir pro
 * navegador. Se fosse o frontend chamando o provedor direto, qualquer pessoa
 * com o inspetor aberto sairia com a credencial de telefonia da empresa.
 *
 * O `metadata` que vai junto volta inteiro no webhook do fim da chamada — é
 * por isso que não precisamos casar a ligação com o lead depois por telefone
 * ou horário, que seria adivinhação.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const API4COM_DIALER = 'https://api.api4com.com/api/v1/dialer'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Login necessário' }, 401)

  // Cliente com o token de QUEM CHAMOU: é assim que auth.uid() resolve pra
  // pessoa certa e o RLS continua valendo nas leituras dela.
  const supabaseUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  )

  const { data: { user } } = await supabaseUsuario.auth.getUser()
  if (!user) return json({ error: 'Sessão inválida' }, 401)

  let corpo: { tenant_id?: string; lead_id?: string; telefone?: string }
  try { corpo = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  const { tenant_id, lead_id, telefone } = corpo
  if (!tenant_id || !lead_id || !telefone) {
    return json({ error: 'tenant_id, lead_id e telefone são obrigatórios' }, 400)
  }

  // O ramal vem do BANCO, pelo vínculo de quem chamou — nunca do corpo da
  // requisição. Senão bastaria mandar o ramal de outra pessoa pra ligar no
  // lugar dela e sujar o registro dela.
  const { data: ramal } = await supabaseUsuario.rpc('meu_ramal', { p_tenant_id: tenant_id })
  if (!ramal) {
    return json({ error: 'Você não tem ramal configurado nesta empresa. Peça ao administrador.' }, 403)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // O lead precisa ser DESTA empresa. Sem isso, alguém com um id de lead
  // alheio faria a ligação sair pela conta de outra empresa.
  const { data: lead } = await admin
    .from('leads')
    .select('id')
    .eq('id', lead_id)
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (!lead) return json({ error: 'Lead não encontrado nesta empresa' }, 404)

  const { data: cred } = await admin
    .from('telefonia_credenciais')
    .select('token, ativo')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (!cred?.token || !cred.ativo) {
    return json({ error: 'Telefonia não configurada para esta empresa' }, 400)
  }

  // Só dígitos, com país. O provedor aceita +55...; mandamos normalizado pra
  // não depender de como o número foi digitado no cadastro.
  const digitos = telefone.replace(/\D/g, '')
  const numero  = digitos.startsWith('55') ? `+${digitos}` : `+55${digitos}`

  try {
    const resposta = await fetch(API4COM_DIALER, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        // Sem "Bearer": a Api4Com espera o token cru no header, e é
        // sensível a maiúsculas. Com o prefixo, ela recusa com 401.
        'Authorization': cred.token,
      },
      body: JSON.stringify({
        extension: ramal,
        phone:     numero,
        // Volta inteiro no webhook — é o que amarra a chamada ao lead.
        metadata: { tenant_id, lead_id, user_id: user.id },
      }),
    })

    const texto = await resposta.text()

    if (!resposta.ok) {
      // O motivo real vem no corpo. Devolver só "falhou" deixaria o vendedor
      // sem saber se é ramal errado, crédito acabado ou token vencido.
      return json({ error: 'O provedor recusou a chamada', detalhe: texto.slice(0, 300) }, 502)
    }

    return json({ ok: true, resposta: texto.slice(0, 300) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: 'Não foi possível falar com o provedor', detalhe: msg.slice(0, 300) }, 502)
  }
})
