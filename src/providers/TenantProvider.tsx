import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useTenantStore } from '@/store/tenantStore'

interface TenantProviderProps {
  children: ReactNode
}

export function TenantProvider({ children }: TenantProviderProps) {
  const tenant = useAuthStore((s) => s.tenant)
  const setSettings = useTenantStore((s) => s.setSettings)

  useEffect(() => {
    if (!tenant?.id) return

    supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenant.id)
      .single()
      .then(({ data }) => {
        setSettings(data)
      })
  }, [tenant?.id])

  return <>{children}</>
}
