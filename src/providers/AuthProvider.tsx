import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface AuthProviderProps {
  children: ReactNode
}

// Dados fictícios para o modo demo (VITE_DEMO_MODE=true)
const DEMO_USER = {
  id: 'demo-user-id',
  email: 'demo@dentalcrm.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as ReturnType<typeof useAuthStore.getState>['user']

const DEMO_TENANT = {
  id: 'demo-tenant-id',
  name: 'Clínica Demo',
  slug: 'clinica-demo',
  plan: 'trial',
  active: true,
  created_at: new Date().toISOString(),
}

const DEMO_MEMBERSHIP = {
  id: 'demo-membership-id',
  user_id: 'demo-user-id',
  tenant_id: 'demo-tenant-id',
  role: 'admin' as const,
  active: true,
  created_at: new Date().toISOString(),
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setSession, setMembership, setTenant, setLoading, clear } = useAuthStore()

  useEffect(() => {
    // Modo demo: injeta estado simulado sem chamar o Supabase
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setUser(DEMO_USER)
      setMembership(DEMO_MEMBERSHIP)
      setTenant(DEMO_TENANT)
      setLoading(false)
      return
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          loadUserContext(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))  // fallback para erros de rede

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserContext(session.user.id)
      } else {
        clear()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserContext(userId: string) {
    const { data: membership } = await supabase
      .from('user_memberships')
      .select('*, tenants(*)')
      .eq('user_id', userId)
      .eq('active', true)
      .single()

    if (membership) {
      setMembership(membership)
      const tenant = (membership as unknown as { tenants: unknown }).tenants
      setTenant(tenant as Parameters<typeof setTenant>[0])
    }

    setLoading(false)
  }

  return <>{children}</>
}
