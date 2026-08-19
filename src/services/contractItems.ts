import { supabase } from '@/lib/supabase'

/**
 * Itens de um contrato — o que foi vendido, e não só quanto.
 *
 * O preço fica no ITEM, não no produto do catálogo: o valor é negociado a cada
 * venda, e depende do modelo de negócio de quem usa o sistema. Ler o preço do
 * catálogo faria um desconto dado hoje reescrever o histórico do contrato
 * fechado ano passado.
 */

export interface ContractItem {
  id:          string
  tenant_id:   string
  contract_id: string
  /** Null quando é item avulso, fora do catálogo. */
  product_id:  string | null
  description: string
  unit_price:  number
  quantity:    number
  created_at:  string
}

export interface CreateContractItemData {
  product_id?:  string | null
  description:  string
  unit_price:   number
  quantity?:    number
}

export function itemTotal(item: Pick<ContractItem, 'unit_price' | 'quantity'>): number {
  return item.unit_price * item.quantity
}

export function itemsTotal(items: ContractItem[]): number {
  return items.reduce((soma, i) => soma + itemTotal(i), 0)
}

export async function fetchContractItems(contractId: string): Promise<ContractItem[]> {
  const { data, error } = await supabase
    .from('contract_items')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at')

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    unit_price: Number(row.unit_price),
    quantity:   Number(row.quantity),
  }))
}

export async function addContractItem(
  tenantId:   string,
  contractId: string,
  data:       CreateContractItemData,
): Promise<ContractItem> {
  const { data: created, error } = await supabase
    .from('contract_items')
    .insert({
      tenant_id:   tenantId,
      contract_id: contractId,
      product_id:  data.product_id ?? null,
      description: data.description.trim(),
      unit_price:  data.unit_price,
      quantity:    data.quantity ?? 1,
    })
    .select()
    .single()

  if (error) throw error
  return { ...created, unit_price: Number(created.unit_price), quantity: Number(created.quantity) }
}

export async function updateContractItem(
  id:   string,
  data: Partial<CreateContractItemData>,
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.description !== undefined) payload.description = data.description.trim()
  if (data.unit_price  !== undefined) payload.unit_price  = data.unit_price
  if (data.quantity    !== undefined) payload.quantity    = data.quantity
  if (data.product_id  !== undefined) payload.product_id  = data.product_id

  const { error } = await supabase.from('contract_items').update(payload).eq('id', id)
  if (error) throw error
}

/** Item some de vez: diferente de contrato, não há histórico a preservar. */
export async function removeContractItem(id: string): Promise<void> {
  const { error } = await supabase.from('contract_items').delete().eq('id', id)
  if (error) throw error
}
