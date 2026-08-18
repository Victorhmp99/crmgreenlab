import { supabase } from '@/lib/supabase'

export type FinancialCategoryType = 'revenue' | 'expense' | 'both'

export interface FinancialCategory {
  id:         string
  tenant_id:  string
  name:       string
  type:       FinancialCategoryType
  active:     boolean
  created_at: string
}

export async function fetchFinancialCategories(tenantId: string): Promise<FinancialCategory[]> {
  const { data, error } = await supabase
    .from('financial_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function createFinancialCategory(
  tenantId: string,
  name:     string,
  type:     FinancialCategoryType,
): Promise<FinancialCategory> {
  const { data, error } = await supabase
    .from('financial_categories')
    .insert({ tenant_id: tenantId, name: name.trim(), type })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deactivateFinancialCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('financial_categories')
    .update({ active: false })
    .eq('id', id)

  if (error) throw error
}
