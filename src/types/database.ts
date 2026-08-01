// Tipos gerados manualmente — substituir pelo output do `supabase gen types` após conectar o projeto

export type UserRole       = 'admin' | 'manager' | 'seller'
export type AccountStatus  = 'pending' | 'active' | 'blocked'
export type SuperAdminType = 'master' | 'auxiliary'
export type LeadStatus = 'active' | 'converted' | 'lost' | 'archived'
export type LeadSource = 'manual' | 'import' | 'meta_ads' | 'google' | 'referral' | 'other'
export type ActivityType = 'call' | 'whatsapp' | 'email' | 'meeting' | 'note' | 'stage_change' | 'import'
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly'
export type RecordType = 'revenue' | 'expense'
export type StageType  = 'in_progress' | 'won' | 'lost'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  active: boolean
  created_at: string
  features?: string[]   // funções liberadas por empresa (feature flags controladas pelo super admin)
}

export interface TenantSettings {
  tenant_id: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  custom_domain: string | null
  webhook_key: string
  updated_at: string
}

export interface UserMembership {
  id: string
  user_id: string
  tenant_id: string
  role: UserRole
  active: boolean
  account_status: AccountStatus
  status_changed_by: string | null
  status_changed_at: string | null
  created_at: string
  max_companies_override: number | null
}

export interface PipelineStage {
  id: string
  tenant_id: string
  pipeline_id?: string           // adicionado em 014 — etapa pertence a uma pipeline
  name: string
  color: string
  position: number
  is_final: boolean
  stage_type?: StageType        // adicionado depois — sempre vem do banco
  funnel_step_id?: string | null // mapeamento opcional para um passo do funil
  created_at: string
}

export interface FunnelStep {
  id:             string
  tenant_id?:     string
  name:           string
  description:    string | null
  color:          string
  position:       number
  activity_types: ActivityType[] | null
  created_at:     string
}

export interface FunnelMetric {
  stepId:           string
  stepName:         string
  stepColor:        string
  stepPosition:     number
  countInStep:      number  // leads ativos cuja etapa atual mapeia para este step
  countAtOrBeyond:  number  // leads ativos neste step OU adiante (cumulativo)
  countLostHere:    number  // leads perdidos cuja última etapa era deste step
}

export interface Lead {
  id: string
  tenant_id: string
  assigned_to: string | null
  name: string
  company_name?: string | null  // adicionado depois — opcional
  phone: string | null
  email: string | null
  status: LeadStatus
  source: LeadSource
  source_campaign: string | null
  notes: string | null
  tags: string[]
  custom_fields: Record<string, unknown>
  value?: number | null      // adicionado depois — opcional
  channel_id?: string | null // adicionado depois — opcional
  created_at: string
  updated_at: string
}

export interface LeadChannel {
  id:         string
  tenant_id:  string
  name:       string
  color:      string
  position:   number
  created_at: string
}

// ── Custom fields ───────────────────────────────────────────────────────────

export type LeadFieldType = 'text' | 'number' | 'boolean' | 'select' | 'textarea'

export interface LeadFieldDefinition {
  id:          string
  tenant_id?:  string
  label:       string
  field_key:   string
  field_type:  LeadFieldType
  options:     string[] | null   // só usado quando field_type='select'
  required:    boolean
  active:      boolean
  position:    number
  created_at:  string
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

export interface WhatsappSettings {
  id:                 string
  tenant_id:          string
  webhook_token:      string
  evolution_url:      string | null
  instance_name:      string | null
  default_stage_id:   string | null
  default_channel_id: string | null
  active:             boolean
  created_at:         string
  updated_at:         string
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

export interface LeadTagDefinition {
  id:         string
  tenant_id:  string
  name:       string
  color:      string
  created_at: string
}

export interface LeadTask {
  id:           string
  tenant_id:    string
  lead_id:      string | null
  created_by:   string | null
  assigned_to:  string | null
  title:        string
  description:  string | null
  due_at:       string
  completed:    boolean
  completed_at: string | null
  created_at:   string
  updated_at:   string
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
