import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// Email hardcoded como fallback de segurança — nunca pode ser bloqueado
const MASTER_EMAIL = 'assessoriagreenlab@gmail.com'

interface AuthProviderProps { children: ReactNode }

const DEMO_USER = {
  id: 'demo-user-id', email: 'demo@greenhub.com',
  app_metadata: {}, user_metadata: {}, aud: 'authenticated',
  created_at: new Date().toISOString(),
} as ReturnType<typeof useAuthStore.getState>['user']

const DEMO_TENANT     = { id: 'demo-tenant-id', name: 'Empresa Demo', slug: 'empresa-demo', plan: 'trial', active: true, created_at: new Date().toISOString() }
const DEMO_MEMBERSHIP = { id: 'demo-membership-id', user_id: 'demo-user-id', tenant_id: 'demo-tenant-id', role: 'admin' as const, active: true, account_status: 'active' as const, status_changed_by: null, status_changed_at: null, created_at: new Date().toISOString() }

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    setUser, setSession, setMembership, setTenant,
    setAccountStatus, setIsSuperAdmin, setIsSuperAdminMaster,
    setLoading, clear,
  } = useAuthStore()

  useEffect(() => {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setUser(DEMO_USER)
      setMembership(DEMO_MEMBERSHIP)
      setTenant(DEMO_TENANT)
      setAccountStatus('active')
      setIsSuperAdmin(false)
      setIsSuperAdminMaster(false)
      setLoading(false)
      return
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          loadUserContext(session.user.id, session.user.email ?? '', 1)
        } else {
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession error:', err)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserContext(session.user.id, session.user.email ?? '', 1)
      } else {
        clear()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Carrega membership + tenant + super_admin.
   *
   * CRÍTICO: o flag de Super Admin Master é definido IMEDIATAMENTE pelo email,
   * antes de qualquer query ao banco. Isso garante que o master nunca é
   * bloqueado por falhas de query, RLS, ou estado inconsistente do banco.
   */
  async function loadUserContext(userId: string, email: string, attempt: number) {
    const MAX_ATTEMPTS = 5
    const DELAY_MS     = attempt * 500

    // ── PASSO 0: Master pelo email é definitivo e imediato ─────────────────
    const isMasterByEmail = email.toLowerCase().trim() === MASTER_EMAIL
    if (isMasterByEmail) {
      console.log('[Auth] Master reconhecido pelo email hardcoded:', email)
      setIsSuperAdmin(true)
      setIsSuperAdminMaster(true)
      setAccountStatus('active')  // Master nunca fica pendente/bloqueado
    }

    try {
      // ── PASSO 1: Membership ──────────────────────────────────────────────
      const { data: membership, error: mErr } = await supabase
        .from('user_memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle()

      if (mErr) {
        console.error('[Auth] membership query error:', mErr)
        // Não retorna se for master pelo email — continua tentando
        if (!isMasterByEmail) {
          setLoading(false)
          return
        }
      }

      // Sem membership ainda — race condition do registro
      if (!membership) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, DELAY_MS))
          return loadUserContext(userId, email, attempt + 1)
        }
        // Esgotou tentativas — se for master pelo email mantém acesso
        setLoading(false)
        return
      }

      // ── PASSO 2: Tenant ──────────────────────────────────────────────────
      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', membership.tenant_id)
        .maybeSingle()

      if (tErr) console.error('[Auth] tenant query error:', tErr)

      // ── PASSO 3: Super admin via banco (suplementa o check por email) ───
      let superAdminType: string | null = null
      let isInSuperAdmins = false

      const { data: superAdmin, error: saErr } = await supabase
        .from('super_admins')
        .select('user_id, type')
        .eq('user_id', userId)
        .maybeSingle()

      if (!saErr) {
        isInSuperAdmins = !!superAdmin
        superAdminType  = superAdmin?.type ?? null
      } else {
        // Fallback: coluna type não existe — tenta query simples
        const { data: saFallback } = await supabase
          .from('super_admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle()
        isInSuperAdmins = !!saFallback
        superAdminType  = saFallback ? 'master' : null
      }

      // ── PASSO 4: Reduz os flags finais ──────────────────────────────────
      const isMasterByDb = superAdminType === 'master'
      const isMaster     = isMasterByEmail || isMasterByDb
      const isSuperAdmin = isInSuperAdmins || isMasterByEmail

      setMembership(membership)
      setTenant(tenant ?? null)
      // Master nunca é pending/blocked — força active
      setAccountStatus(isMaster ? 'active' : (membership.account_status ?? 'active'))
      setIsSuperAdmin(isSuperAdmin)
      setIsSuperAdminMaster(isMaster)

      console.log('[Auth] Contexto carregado:', {
        email,
        role: membership.role,
        isMaster,
        isSuperAdmin,
        accountStatus: membership.account_status,
      })

    } catch (err) {
      console.error('[Auth] loadUserContext unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  return <>{children}</>
}
