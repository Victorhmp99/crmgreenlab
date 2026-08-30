import { supabase } from '@/lib/supabase'

/**
 * Regras de movimentação do funil.
 *
 * Nascem DESLIGADAS e são por funil. Ligar pra todo mundo de uma vez quebraria
 * quem já usa o quadro de outro jeito — tem empresa com etapa "PROPOSTA
 * ENVIADA" marcada como venda, que travaria na hora.
 *
 * A checagem de verdade é um gatilho no banco. O que existe aqui é conforto:
 * perguntar o motivo antes de mover, em vez de deixar o card voltar sozinho
 * com uma mensagem de erro — que funciona, mas parece defeito.
 */

export interface RegrasPipeline {
  exigirContratoParaGanhar: boolean
  exigirMotivoPerda:        boolean
}

export async function fetchRegrasPipeline(pipelineId: string): Promise<RegrasPipeline> {
  const { data, error } = await supabase
    .from('pipelines')
    .select('exigir_contrato_para_ganhar, exigir_motivo_perda')
    .eq('id', pipelineId)
    .maybeSingle()

  if (error) throw error

  return {
    exigirContratoParaGanhar: data?.exigir_contrato_para_ganhar ?? false,
    exigirMotivoPerda:        data?.exigir_motivo_perda ?? false,
  }
}

export async function salvarRegrasPipeline(
  pipelineId: string,
  regras:     RegrasPipeline,
): Promise<void> {
  const { error } = await supabase
    .from('pipelines')
    .update({
      exigir_contrato_para_ganhar: regras.exigirContratoParaGanhar,
      exigir_motivo_perda:         regras.exigirMotivoPerda,
    })
    .eq('id', pipelineId)

  if (error) throw error
}

/**
 * Lista fechada de propósito: motivo digitado à mão vira 50 grafias da mesma
 * coisa e nunca dá pra somar. O "outro" existe pro caso raro, e é ele que
 * mostra, com o tempo, se falta uma opção na lista.
 */
export const MOTIVOS_PERDA = [
  { valor: 'preco',          rotulo: 'Achou caro' },
  { valor: 'distancia',      rotulo: 'Distância / localização' },
  { valor: 'concorrente',    rotulo: 'Fechou com concorrente' },
  { valor: 'sem_resposta',   rotulo: 'Sumiu / não respondeu' },
  { valor: 'fora_do_perfil', rotulo: 'Fora do perfil' },
  { valor: 'sem_interesse',  rotulo: 'Não tinha interesse real' },
  { valor: 'adiou',          rotulo: 'Adiou a decisão' },
  { valor: 'outro',          rotulo: 'Outro' },
] as const

export function rotuloDoMotivo(valor: string | null): string {
  if (!valor) return '—'
  return MOTIVOS_PERDA.find((m) => m.valor === valor)?.rotulo ?? valor
}

export async function definirMotivoPerda(leadId: string, motivo: string): Promise<void> {
  // Via RPC: leads tem RLS, e uma escrita bloqueada voltaria como sucesso com
  // zero linhas — o motivo sumiria sem erro e o gatilho recusaria a mudança
  // logo depois, sem ninguém entender por quê.
  const { error } = await supabase.rpc('definir_motivo_perda', {
    p_lead_id: leadId,
    p_motivo:  motivo,
  })
  if (error) throw error
}
