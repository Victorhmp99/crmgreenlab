import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TenantOption } from '@/store/authStore'
import type { Tenant, UserMembership } from '@/types'

// Email hardcoded como fallback de segurança — nunca pode ser bloqueado
const MASTER_EMAIL = 'assessoriagreenlab@gmail.com'

interface AuthProviderProps { children: ReactNode }

const DEMO_USER = {
  id: 'demo-user-id', email: 'demo@greenhub.com',
  app_metadata: {}, user_metadata: {}, aud: 'authenticated',
  created_at: new Date().toISOString(),
} as ReturnType<typeof useAuthStore.getState>['user']

const DEMO_TENANT     = { id: 'demo-tenant-id', name: 'Empresa Demo', slug: 'empresa-demo', plan: 'trial', active: true, created_at: new Date().toISOString() }
const DEMO_MEMBERSHIP = { id: 'demo-membership-id', user_id: 'demo-user-id', tenant_id: 'demo-tenant-id', role: 'admin' as const, active: true, account_status: 'active' as const, status_changed_by: null, status_changed_at: null, created_at: new Date().toISOString(), max_companies_override: null }

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    setUser, setSession, setMembership, setTenant, setAvailableTenants,
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
      setAvailableTenants([{ tenant: DEMO_TENANT, membership: DEMO_MEMBERSHIP }])
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
   * Carrega TODAS as memberships do usuário, seleciona a empresa ativa
   * (respeitando lastTenantId salvo no localStorage) e popula o store.
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
      setAccountStatus('active')
    }

    try {
      // ── PASSO 1: Todas as memberships ativas do usuário ──────────────────
      const { data: memberships, error: mErr } = await supabase
        .from('user_memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)

      if (mErr) {
        console.error('[Auth] membership query error:', mErr)
        if (!isMasterByEmail) { setLoading(false); return }
      }

      // Race condition pós-registro — retenta
      if (!memberships || memberships.length === 0) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, DELAY_MS))
          return loadUserContext(userId, email, attempt + 1)
        }
        setLoading(false)
        return
      }

      // ── PASSO 2: Todos os tenants das memberships ────────────────────────
      const tenantIds = memberships.map((m) => m.tenant_id)
      const { data: tenants, error: tErr } = await supabase
        .from('tenants')
        .select('*')
        .in('id', tenantIds)

      if (tErr) console.error('[Auth] tenants query error:', tErr)

      const tenantMap = new Map<string, Tenant>((tenants ?? []).map((t) => [t.id, t]))

      // Monta lista de opções disponíveis. Empresa DESATIVADA (active=false)
      // pelo super admin some para os usuários dela — é isso que faz o botão
      // "Desativar empresa" ter efeito de verdade. O Master nunca é filtrado,
      // pra nunca ficar sem acesso e conseguir reativar.
      const options: TenantOption[] = (memberships as UserMembership[])
        .filter((m) => {
          const t = tenantMap.get(m.tenant_id)
          if (!t) return false
          return isMasterByEmail || t.active !== false
        })
        .map((m) => ({ tenant: tenantMap.get(m.tenant_id)!, membership: m }))

      setAvailableTenants(options)

      // ── PASSO 3: Escolhe empresa ativa ───────────────────────────────────
      const lastTenantId = localStorage.getItem('lastTenantId')
      const preferred    = lastTenantId
        ? options.find((o) => o.tenant.id === lastTenantId)
        : null
      const active = preferred ?? options[0]

      if (!active) { setLoading(false); return }

      setMembership(active.membership)
      setTenant(active.tenant)
      localStorage.setItem('lastTenantId', active.tenant.id)

      // ── PASSO 4: Super admin via banco ───────────────────────────────────
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

      // ── PASSO 5: Flags finais ────────────────────────────────────────────
      const isMasterByDb = superAdminType === 'master'
      const isMaster     = isMasterByEmail || isMasterByDb
      const isSA         = isInSuperAdmins || isMasterByEmail

      setAccountStatus(isMaster ? 'active' : (active.membership.account_status ?? 'active'))
      setIsSuperAdmin(isSA)
      setIsSuperAdminMaster(isMaster)

      console.log('[Auth] Contexto carregado:', {
        email,
        role:          active.membership.role,
        activeTenant:  active.tenant.name,
        totalTenants:  options.length,
        isMaster,
        isSuperAdmin:  isSA,
      })

    } catch (err) {
      console.error('[Auth] loadUserContext unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  return <>{children}</>
}
