import { supabase } from '@/lib/supabase'

const MASTER_EMAIL = 'assessoriagreenlab@gmail.com'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'empresa'
}

export interface RegisterResult {
  needsEmailConfirmation: boolean
  accountStatus: 'active' | 'pending'
}

/**
 * Registra novo tenant + conta admin.
 * Usa RPC atômico no banco — se qualquer passo falha, tudo é desfeito.
 */
export async function registerTenant(
  companyName:  string,
  email:        string,
  password:     string,
  signupToken?: string,
): Promise<RegisterResult> {
  const isMaster = email.toLowerCase() === MASTER_EMAIL

  // 1. Cria usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) throw authError
  if (!authData.user) throw new Error('Não foi possível criar o usuário.')

  if (!authData.session) {
    return { needsEmailConfirmation: true, accountStatus: 'pending' }
  }

  const userId = authData.user.id

  // 2. RPC atômico: cria tenant + membership + settings em uma única transação
  //    Se for master ou token válido, account_status = 'active'; senão 'pending'
  const { data: result, error: rpcError } = await supabase.rpc('register_new_tenant_with_admin', {
    p_user_id:      userId,
    p_company_name: companyName,
    p_slug:         toSlug(companyName),
    p_signup_token: signupToken ?? null,
  })

  if (rpcError) {
    console.error('[Register] RPC error:', rpcError)
    throw new Error(`Erro ao criar empresa: ${rpcError.message}`)
  }

  // 3. Determina o status final (master sempre é active)
  let accountStatus: 'active' | 'pending' = isMaster ? 'active' : (result?.account_status ?? 'pending')

  // 4. Se for master, garante registro em super_admins
  if (isMaster) {
    await supabase
      .from('super_admins')
      .upsert({ user_id: userId, type: 'master' })

    // Master é forçado a active mesmo que o RPC tenha retornado pending
    if (result && result.account_status !== 'active') {
      await supabase
        .from('user_memberships')
        .update({ account_status: 'active' })
        .eq('user_id', userId)
      accountStatus = 'active'
    }
  }

  // 5. Força novo ciclo de auth para o AuthProvider reler a membership
  await supabase.auth.refreshSession()

  return { needsEmailConfirmation: false, accountStatus }
}
