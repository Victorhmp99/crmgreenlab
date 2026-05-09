// Tipos gerados manualmente — substituir pelo output do `supabase gen types` após conectar o projeto

export type UserRole = 'admin' | 'manager' | 'seller'
export type LeadStatus = 'active' | 'converted' | 'lost' | 'archived'
export type LeadSource = 'manual' | 'import' | 'meta_ads' | 'google' | 'referral' | 'other'
export type ActivityType = 'call' | 'whatsapp' | 'email' | 'meeting' | 'note' | 'stage_change' | 'import'
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly'
export type RecordType = 'revenue' | 'expense'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  active: boolean
  created_at: string
}

export interface TenantSettings {
  tenant_id: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  custom_domain: string | null
  updated_at: string
}

export interface UserMembership {
  id: string
  user_id: string
  tenant_id: string
  role: UserRole
  active: boolean
  created_at: string
}

export interface PipelineStage {
  id: string
  tenant_id: string
  name: string
  color: string
  position: number
  is_final: boolean
  created_at: string
}

export interface Lead {
  id: string
  tenant_id: string
  assigned_to: string | null
  name: string
  phone: string | null
  email: string | null
  status: LeadStatus
  source: LeadSource
  source_campaign: string | null
  notes: string | null
  tags: string[]
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PipelineCard {
  id: string
  tenant_id: string
  lead_id: string
  stage_id: string
  position: number
  moved_at: string
  moved_by: string | null
}

export interface LeadActivity {
  id: string
  tenant_id: string
  lead_id: string
  user_id: string | null
  type: ActivityType
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Goal {
  id: string
  tenant_id: string
  user_id: string
  period: GoalPeriod
  start_date: string
  end_date: string
  leads_target: number | null
  calls_target: number | null
  deals_target: number | null
  revenue_target: number | null
  created_by: string | null
  created_at: string
}

// Tipo genérico para as respostas do Supabase
export type Database = {
  public: {
    Tables: {
      tenants: { Row: Tenant; Insert: Omit<Tenant, 'id' | 'created_at'>; Update: Partial<Tenant> }
      tenant_settings: { Row: TenantSettings; Insert: TenantSettings; Update: Partial<TenantSettings> }
      user_memberships: { Row: UserMembership; Insert: Omit<UserMembership, 'id' | 'created_at'>; Update: Partial<UserMembership> }
      leads: { Row: Lead; Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Lead> }
      pipeline_stages: { Row: PipelineStage; Insert: Omit<PipelineStage, 'id' | 'created_at'>; Update: Partial<PipelineStage> }
      pipeline_cards: { Row: PipelineCard; Insert: Omit<PipelineCard, 'id'>; Update: Partial<PipelineCard> }
      lead_activities: { Row: LeadActivity; Insert: Omit<LeadActivity, 'id' | 'created_at'>; Update: never }
      goals: { Row: Goal; Insert: Omit<Goal, 'id' | 'created_at'>; Update: Partial<Goal> }
    }
  }
}
