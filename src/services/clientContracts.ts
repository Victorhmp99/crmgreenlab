import { supabase } from '@/lib/supabase'
import { fetchLeadPurchases } from '@/services/financial'
import { updateLead } from '@/services/leads'
import {
  getCurrentInstallment,
  getContractTotalValue,
  getContractAccruedRevenue,
  expandAccruedInstallments,
  type AccruedInstallment,
} from '@/services/contractAccrual'

export {
  getCurrentInstallment,
  getContractTotalValue,
  getContractAccruedRevenue,
  expandAccruedInstallments,
  type AccruedInstallment,
}

export type ContractBillingType = 'recurring' | 'one_time'
export type ContractStatus      = 'active' | 'paused' | 'cancelled' | 'completed' | 'upgraded'

export interface ClientContract {
  id:                string
  tenant_id:         string
  lead_id:           string
  billing_type:      ContractBillingType
  is_percentage:     boolean
  percentage_value:  number | null
  amount:            number
  /** null = recorrente sem prazo determinado (continua até cancelar) */
  installments:      number | null
  start_date:        string
  /** Fim do contrato. Ao chegar, ele é pausado e vira tarefa de renovação. */
  end_date:          string | null
  /** Quando a rotina diária avisou do vencimento. Null = ainda não venceu. */
  renewal_notified_at: string | null
  /** Contrato que este substituiu, numa troca de plano. */
  previous_contract_id: string | null
  billing_day:       number | null
  status:            ContractStatus
  created_by:        string | null
  created_at:         string
  updated_at:         string
}

export interface CreateContractData {
  lead_id:           string
  billing_type:      ContractBillingType
  is_percentage:     boolean
  percentage_value?: number | null
  amount:            number
  /** null = recorrente sem prazo determinado */
  installments:      number | null
  start_date:        string
  end_date?:         string | null
  billing_day?:      number | null
  /** Preenchido quando este contrato SUBSTITUI outro (upsell/downgrade). O
   *  antigo vira status 'upgraded' — diferente de cancelado, não conta como
   *  perda de cliente nos relatórios. */
  previous_contract_id?: string | null
}

/** Busca o contrato mais recente de um lead (qualquer status) */
export async function fetchLeadContract(leadId: string): Promise<ClientContract | null> {
  const { data, error } = await supabase
    .from('client_contracts')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    amount:           Number(data.amount),
    percentage_value: data.percentage_value != null ? Number(data.percentage_value) : null,
  }
}

/** Cria o contrato e gera as tarefas de cobrança automaticamente (RPC atômica) */
export async function createClientContract(
  tenantId:  string,
  createdBy: string,
  data:      CreateContractData,
): Promise<string> {
  const { data: contractId, error } = await supabase.rpc('create_client_contract', {
    p_tenant_id:        tenantId,
    p_lead_id:           data.lead_id,
    p_billing_type:      data.billing_type,
    p_is_percentage:     data.is_percentage,
    p_percentage_value:  data.percentage_value ?? null,
    p_amount:            data.amount,
    p_installments:      data.installments,
    p_start_date:        data.start_date,
    p_billing_day:       data.billing_day ?? null,
    p_created_by:        createdBy,
    p_end_date:          data.end_date ?? null,
    p_previous_contract_id: data.previous_contract_id ?? null,
  })

  if (error) throw error
  return contractId as string
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<void> {
  const { error } = await supabase.from('client_contracts').update({ status }).eq('id', id)
  if (error) throw error
}

export interface UpdateContractData {
  billing_type?:      ContractBillingType
  is_percentage?:     boolean
  percentage_value?:  number | null
  amount?:            number
  installments?:      number | null
  start_date?:        string
  end_date?:          string | null
  billing_day?:       number | null
  status?:            ContractStatus
}

/**
 * Edita os campos do contrato (valor, parcelas, %, etc). Não mexe nas tarefas
 * de cobrança já geradas — elas continuam com os valores/datas originais.
 * Se quiser tarefas atualizadas, cancele e crie um novo contrato.
 */
export async function updateContract(id: string, data: UpdateContractData): Promise<void> {
  const payload: Record<string, unknown> = { ...data }

  // Reativar um contrato zera o aviso de renovação. Sem isso, o contrato
  // renovado venceria de novo e a rotina diária ficaria calada, porque ela
  // ignora quem já foi avisado uma vez.
  if (data.status === 'active') payload.renewal_notified_at = null

  const { error } = await supabase.from('client_contracts').update(payload).eq('id', id)
  if (error) throw error
}

/**
 * Recalcula e persiste leads.value = valor total do contrato ativo/pausado
 * + soma de todos os produtos/adicionais lançados pra esse lead.
 * Chamado automaticamente sempre que o contrato ou uma compra muda.
 */
export async function recalculateLeadValue(leadId: string): Promise<number> {
  const [contract, purchases] = await Promise.all([
    fetchLeadContract(leadId),
    fetchLeadPurchases(leadId),
  ])
  const contractTotal = getContractTotalValue(contract)
  const purchasesSum  = purchases.reduce((sum, p) => sum + p.amount, 0)
  const total = contractTotal + purchasesSum

  await updateLead(leadId, { value: total > 0 ? total : null })
  return total
}

/**
 * Gera mais um lote de lembretes de cobrança pra um contrato recorrente SEM
 * PRAZO — continua a partir do último lembrete já gerado pra esse lead.
 */
export async function generateMoreReminders(
  tenantId:  string,
  leadId:    string,
  amount:    number,
  createdBy: string,
  months = 12,
): Promise<number> {
  const { data, error } = await supabase.rpc('generate_more_contract_reminders', {
    p_tenant_id:  tenantId,
    p_lead_id:    leadId,
    p_amount:     amount,
    p_created_by: createdBy,
    p_months:     months,
  })
  if (error) throw error
  return data as number
}

export interface MRRSummary {
  activeMRR:      number
  activeContracts: number
}

/** MRR = soma do valor mensal de todos os contratos recorrentes ativos */
export async function fetchActiveMRR(tenantId: string): Promise<MRRSummary> {
  const { data, error } = await supabase
    .from('client_contracts')
    .select('amount')
    .eq('tenant_id', tenantId)
    .eq('billing_type', 'recurring')
    .eq('status', 'active')

  if (error) throw error
  const rows = data ?? []
  return {
    activeMRR:       rows.reduce((sum, r) => sum + Number(r.amount), 0),
    activeContracts: rows.length,
  }
}
