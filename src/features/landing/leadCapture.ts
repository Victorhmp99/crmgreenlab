/**
 * Envio do formulário da landing para o webhook público de captação
 * (Edge Function `receive-lead`).
 *
 * As credenciais vêm de variáveis de ambiente e NÃO ficam no repositório.
 * Elas continuam visíveis no JS publicado — é inerente a um formulário que
 * posta direto do navegador. As defesas do endpoint são o honeypot, o rate
 * limit por IP/hora e a possibilidade de regenerar a chave em Configurações
 * sem precisar de novo deploy de código.
 */

const ENDPOINT    = import.meta.env.VITE_LEAD_WEBHOOK_URL as string | undefined
const TENANT_ID   = import.meta.env.VITE_LEAD_TENANT_ID as string | undefined
const WEBHOOK_KEY = import.meta.env.VITE_LEAD_WEBHOOK_KEY as string | undefined
const PIPELINE_ID = import.meta.env.VITE_LEAD_PIPELINE_ID as string | undefined

/** Se faltar qualquer credencial, o formulário se desativa em vez de falhar no envio. */
export const leadCaptureEnabled = Boolean(ENDPOINT && TENANT_ID && WEBHOOK_KEY && PIPELINE_ID)

export interface LandingLead {
  nome:        string
  whatsapp:    string
  instagram:   string
  faturamento: string
  /** Honeypot: invisível pro usuário. Preenchido = robô. */
  _hp?:        string
}

/** Mantém só os dígitos — o CRM guarda telefone sem máscara. */
function digits(s: string): string {
  return s.replace(/\D/g, '')
}

export async function submitLandingLead(lead: LandingLead): Promise<void> {
  if (!leadCaptureEnabled) throw new Error('Captação não configurada')

  const phone = digits(lead.whatsapp)

  const res = await fetch(ENDPOINT!, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id:   TENANT_ID,
      webhook_key: WEBHOOK_KEY,
      pipeline_id: PIPELINE_ID,
      name:        lead.nome.trim(),
      phone,
      source:      'other',
      custom_fields: {
        nome_e_sobrenome:                 lead.nome.trim(),
        instagram:                        lead.instagram.trim(),
        whatsapp:                         phone,
        qual_seu_faturamento_medio_mensal: lead.faturamento,
      },
      ...(lead._hp ? { _hp: lead._hp } : {}),
    }),
  })

  if (!res.ok) {
    // O endpoint devolve { error } em JSON; se o corpo não for JSON,
    // cai no genérico em vez de estourar aqui.
    let detail = ''
    try { detail = (await res.json())?.error ?? '' } catch { /* corpo não-JSON */ }
    throw new Error(detail || 'Não foi possível enviar. Tente novamente.')
  }
}
