import { supabase } from '@/lib/supabase'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'empresa'
}

interface RegisterResult {
  needsEmailConfirmation: boolean
}

export async function registerTenant(
  companyName: string,
  email: string,
  password: string,
): Promise<RegisterResult> {
  // 1. Cria usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) throw authError
  if (!authData.user) throw new Error('Não foi possível criar o usuário.')

  if (!authData.session) {
    return { needsEmailConfirmation: true }
  }

  const userId = authData.user.id

  // 2. Cria o tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: companyName, slug: toSlug(companyName), plan: 'trial', active: true })
    .select()
    .single()
  if (tenantError) throw tenantError

  // 3. Cria membership de admin
  const { error: membershipError } = await supabase
    .from('user_memberships')
    .insert({ user_id: userId, tenant_id: tenant.id, role: 'admin', active: true })
  if (membershipError) throw membershipError

  // 4. Cria configurações padrão do tenant
  await supabase
    .from('tenant_settings')
    .insert({
      tenant_id:       tenant.id,
      primary_color:   '#00e676',
      secondary_color: '#00c853',
      logo_url:        null,
      custom_domain:   null,
    })
    .maybeSingle()

  // 5. CRÍTICO: força novo ciclo de auth para o AuthProvider encontrar a membership
  //    O onAuthStateChange disparou no signUp ANTES da membership existir.
  //    O refreshSession faz ele disparar novamente — agora com a membership no banco.
  await supabase.auth.refreshSession()

  return { needsEmailConfirmation: false }
}
