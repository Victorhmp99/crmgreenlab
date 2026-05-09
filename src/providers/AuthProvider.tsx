import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface AuthProviderProps { children: ReactNode }

const DEMO_USER = {
  id: 'demo-user-id', email: 'demo@greenhub.com',
  app_metadata: {}, user_metadata: {}, aud: 'authenticated',
  created_at: new Date().toISOString(),
} as ReturnType<typeof useAuthStore.getState>['user']

const DEMO_TENANT  = { id: 'demo-tenant-id', name: 'Empresa Demo', slug: 'empresa-demo', plan: 'trial', active: true, created_at: new Date().toISOString() }
const DEMO_MEMBERSHIP = { id: 'demo-membership-id', user_id: 'demo-user-id', tenant_id: 'demo-tenant-id', role: 'admin' as const, active: true, created_at: new Date().toISOString() }

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setSession, setMembership, setTenant, setIsSuperAdmin, setLoading, clear } = useAuthStore()

  useEffect(() => {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setUser(DEMO_USER)
      setMembership(DEMO_MEMBERSHIP)
      setTenant(DEMO_TENANT)
      setIsSuperAdmin(false)
      setLoading(false)
      return
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) loadUserContext(session.user.id)
        else setLoading(false)
      })
      .catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadUserContext(session.user.id)
      else clear()
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Carrega membership + super admin status.
   * Tenta até 5 vezes com delay crescente — resolve o race condition
   * onde o onAuthStateChange dispara antes da membership ser salva no banco
   * (acontece no fluxo de registro: signUp → membership criada → refresh).
   */
  async function loadUserContext(userId: string, attempt = 1) {
    const MAX_ATTEMPTS = 5
    const DELAY_MS     = attempt * 400   // 400ms, 800ms, 1200ms, 1600ms, 2000ms

    const [membershipRes, superAdminRes] = await Promise.all([
      supabase
        .from('user_memberships')
        .select('*, tenants(*)')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('super_admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    setIsSuperAdmin(!!superAdminRes.data)

    if (!membershipRes.data && attempt < MAX_ATTEMPTS) {
      // Membership ainda não encontrada — aguarda e tenta novamente
      await new Promise(r => setTimeout(r, DELAY_MS))
      return loadUserContext(userId, attempt + 1)
    }

    if (membershipRes.data) {
      setMembership(membershipRes.data)
      const tenant = (membershipRes.data as unknown as { tenants: unknown }).tenants
      setTenant(tenant as Parameters<typeof setTenant>[0])
    }

    setLoading(false)
  }

  return <>{children}</>
}
