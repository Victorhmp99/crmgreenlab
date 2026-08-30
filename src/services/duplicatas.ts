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
  /** Os 8 dígitos finais que fizeram os leads casarem. */
  chave: string
  leads: LeadDuplicado[]
}

export async function buscarDuplicatas(tenantId: string): Promise<GrupoDuplicado[]> {
  const { data, error } = await supabase.rpc('buscar_leads_duplicados', { p_tenant_id: tenantId })
  if (error) throw error

  const linhas = (data ?? []) as Array<{
    chave: string; lead_id: string; nome: string | null; telefone: string | null
    email: string | null; criado_em: string; etapa: string | null
    responsavel: string | null; atividades: number; contratos: number
  }>

  // O banco devolve linha a linha, já ordenado por chave e do mais antigo pro
  // mais novo. Agrupar aqui preserva essa ordem — e é ela que faz o primeiro
  // de cada grupo ser o candidato natural a ser mantido.
  const grupos = new Map<string, GrupoDuplicado>()
  for (const l of linhas) {
    if (!grupos.has(l.chave)) grupos.set(l.chave, { chave: l.chave, leads: [] })
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
