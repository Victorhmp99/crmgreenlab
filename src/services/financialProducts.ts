import { supabase } from '@/lib/supabase'

export interface FinancialProduct {
  id:            string
  tenant_id:     string
  name:          string
  default_price: number | null
  cost_price:    number | null
  active:        boolean
  created_at:    string
}

export interface CreateFinancialProductData {
  name:          string
  default_price?: number | null
  cost_price?:    number | null
}

/** Margem de lucro em % — null quando não há preço ou custo suficiente pra calcular */
export function calcMargin(defaultPrice: number | null, costPrice: number | null): number | null {
  if (defaultPrice == null || defaultPrice <= 0 || costPrice == null) return null
  return Math.round(((defaultPrice - costPrice) / defaultPrice) * 100 * 10) / 10
}

export async function fetchFinancialProducts(tenantId: string): Promise<FinancialProduct[]> {
  const { data, error } = await supabase
    .from('financial_products')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    default_price: row.default_price != null ? Number(row.default_price) : null,
    cost_price:    row.cost_price    != null ? Number(row.cost_price)    : null,
  }))
}

export async function createFinancialProduct(
  tenantId: string,
  data:     CreateFinancialProductData,
): Promise<FinancialProduct> {
  const { data: created, error } = await supabase
    .from('financial_products')
    .insert({
      tenant_id:     tenantId,
      name:          data.name.trim(),
      default_price: data.default_price ?? null,
      cost_price:    data.cost_price ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return created
}

export async function updateFinancialProduct(
  id:   string,
  data: Partial<CreateFinancialProductData>,
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.name          !== undefined) payload.name          = data.name.trim()
  if (data.default_price !== undefined) payload.default_price = data.default_price
  if (data.cost_price     !== undefined) payload.cost_price    = data.cost_price

  const { error } = await supabase.from('financial_products').update(payload).eq('id', id)
  if (error) throw error
}

export async function deactivateFinancialProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('financial_products')
    .update({ active: false })
    .eq('id', id)

  if (error) throw error
}
