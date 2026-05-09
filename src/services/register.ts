import { supabase } from '@/lib/supabase'

// Converte nome da clínica em slug URL-safe
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'clinica'
}

interface RegisterResult {
  needsEmailConfirmation: boolean
}

/**
 * Cria conta do primeiro admin + tenant em uma única transação.
 * Requer as seguintes políticas RLS no Supabase:
 *   - tenants: INSERT permitido para authenticated
 *   - user_memberships: INSERT permitido para authenticated
 * (ver migration 012_register_policies.sql)
 */
export async function registerTenant(
  clinicName: string,
  email: string,
  password: string,
): Promise<RegisterResult> {
  // 1. Cria usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) throw authError
  if (!authData.user) throw new Error('Não foi possível criar o usuário.')

  const userId = authData.user.id

  // Se Supabase exige confirmação de e-mail, a session será null
  // Nesse caso não conseguimos criar o tenant ainda (sem sessão = sem auth para RLS)
  // → retornamos needsEmailConfirmation: true e o usuário completa após confirmar
  if (!authData.session) {
    return { needsEmailConfirmation: true }
  }

  // 2. Cria o tenant
  const slug = toSlug(clinicName)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: clinicName, slug, plan: 'trial', active: true })
    .select()
    .single()

  if (tenantError) throw tenantError

  // 3. Cria membership de admin
  const { error: membershipError } = await supabase
    .from('user_memberships')
    .insert({
      user_id:   userId,
      tenant_id: tenant.id,
      role:      'admin',
      active:    true,
    })

  if (membershipError) throw membershipError

  // 4. Cria configurações padrão do tenant (white-label)
  await supabase
    .from('tenant_settings')
    .insert({
      tenant_id:     tenant.id,
      primary_color: '#00e676',
      secondary_color: '#00c853',
      logo_url:      null,
      custom_domain: null,
    })
    .maybeSingle()   // ignora erro se já existir

  return { needsEmailConfirmation: false }
}
