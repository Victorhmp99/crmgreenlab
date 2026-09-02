import { supabase } from '@/lib/supabase'

/**
 * Leads repetidos — sempre dentro de UMA empresa.
 *
 * O tenant vai como parâmetro e é conferido no banco: as funções são
 * SECURITY DEFINER, então elas ignoram o RLS e a checagem de empresa mora lá
 * dentro. Confiar no filtro do frontend aqui deixaria o telefone de uma
 * clínica aparecer na tela de outra.
 */

export interface LeadDuplicado {
  leadId:      string
  nome:        string | null
  telefone:    string | null
  email:       string | null
  criadoEm:    string
  etapa:       string | null
  responsavel: string | null
  atividades:  number
  contratos:   number
}

export interface GrupoDuplicado {
  chave: string
  /** Por que casaram: mesmo telefone, mesmo e-mail ou mesmo nome. */
  motivo: string
  leads: LeadDuplicado[]
}

export interface LeadSemContato {
  leadId:     string
  nome:       string | null
  criadoEm:   string
  origem:     string | null
  etapa:      string | null
  atividades: number
  contratos:  number
}

export async function buscarDuplicatas(tenantId: string): Promise<GrupoDuplicado[]> {
  const { data, error } = await supabase.rpc('buscar_leads_duplicados', { p_tenant_id: tenantId })
  if (error) throw error

  const linhas = (data ?? []) as Array<{
    chave: string; motivo: string; lead_id: string; nome: string | null; telefone: string | null
    email: string | null; criado_em: string; etapa: string | null
    responsavel: string | null; atividades: number; contratos: number
  }>

  // O banco devolve linha a linha, já ordenado por chave e do mais antigo pro
  // mais novo. Agrupar aqui preserva essa ordem — e é ela que faz o primeiro
  // de cada grupo ser o candidato natural a ser mantido.
  const grupos = new Map<string, GrupoDuplicado>()
  for (const l of linhas) {
    if (!grupos.has(l.chave)) grupos.set(l.chave, { chave: l.chave, motivo: l.motivo, leads: [] })
    grupos.get(l.chave)!.leads.push({
      leadId:      l.lead_id,
      nome:        l.nome,
      telefone:    l.telefone,
      email:       l.email,
      criadoEm:    l.criado_em,
      etapa:       l.etapa,
      responsavel: l.responsavel,
      atividades:  Number(l.atividades ?? 0),
      contratos:   Number(l.contratos ?? 0),
    })
  }
  return [...grupos.values()]
}

/**
 * Junta um lead no outro. Não é "apagar o repetido": contratos, financeiro,
 * atividades, tarefas e etiquetas são movidos antes de o repetido sumir.
 */
export async function mesclarLeads(
  tenantId: string,
  manter:   string,
  remover:  string,
): Promise<void> {
  const { error } = await supabase.rpc('mesclar_leads', {
    p_tenant_id: tenantId,
    p_manter:    manter,
    p_remover:   remover,
  })
  if (error) throw error
}

/**
 * Leads sem telefone e sem e-mail — não há como falar com eles.
 *
 * Vem separado das duplicatas de propósito: aqui não se escolhe qual fica, se
 * decide o que jogar fora. Misturar as duas coisas na mesma lista faria alguém
 * apagar sem querer o lead que queria manter.
 */
export async function buscarLeadsSemContato(tenantId: string): Promise<LeadSemContato[]> {
  const { data, error } = await supabase.rpc('buscar_leads_sem_contato', { p_tenant_id: tenantId })
  if (error) throw error

  return ((data ?? []) as Array<{
    lead_id: string; nome: string | null; criado_em: string; origem: string | null
    etapa: string | null; atividades: number; contratos: number
  }>).map((l) => ({
    leadId:     l.lead_id,
    nome:       l.nome,
    criadoEm:   l.criado_em,
    origem:     l.origem,
    etapa:      l.etapa,
    atividades: Number(l.atividades ?? 0),
    contratos:  Number(l.contratos ?? 0),
  }))
}

/** Devolve quantos foram apagados e quantos o banco recusou (têm contrato). */
export async function excluirLeadsSemContato(
  tenantId: string, ids: string[],
): Promise<{ apagados: number; preservados: number }> {
  const { data, error } = await supabase.rpc('excluir_leads_sem_contato', {
    p_tenant_id: tenantId,
    p_ids:       ids,
  })
  if (error) throw error

  const linha = (data as Array<{ apagados: number; preservados: number }> | null)?.[0]
  return { apagados: linha?.apagados ?? 0, preservados: linha?.preservados ?? 0 }
}
