import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { UserMembership, Tenant, AccountStatus } from '@/types'

export interface TenantOption {
  tenant:     Tenant
  membership: UserMembership
}

interface AuthState {
  user:               User | null
  session:            Session | null
  membership:         UserMembership | null
  tenant:             Tenant | null
  accountStatus:      AccountStatus | null
  isSuperAdmin:       boolean   // true para master e auxiliary
  isSuperAdminMaster: boolean   // true somente para master
  isLoading:          boolean

  /** Todas as empresas que o usuário pertence (ativas) */
  availableTenants: TenantOption[]

  setUser:               (user: User | null) => void
  setSession:            (session: Session | null) => void
  setMembership:         (membership: UserMembership | null) => void
  setTenant:             (tenant: Tenant | null) => void
  setAccountStatus:      (status: AccountStatus | null) => void
  setIsSuperAdmin:       (v: boolean) => void
  setIsSuperAdminMaster: (v: boolean) => void
  setLoading:            (isLoading: boolean) => void
  setAvailableTenants:   (tenants: TenantOption[]) => void

  /** Troca a empresa ativa. Cache React Query é invalidado externamente. */
  switchTenant: (option: TenantOption) => void

  /**
   * Remove empresa excluída do estado e troca para a próxima disponível.
   * Retorna true se ainda há empresas, false se o usuário ficou sem nenhuma.
   */
  removeTenant: (tenantId: string) => boolean

  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:               null,
  session:            null,
  membership:         null,
  tenant:             null,
  accountStatus:      null,
  isSuperAdmin:       false,
  isSuperAdminMaster: false,
  isLoading:          true,
  availableTenants:   [],

  setUser:               (user)               => set({ user }),
  setSession:            (session)            => set({ session }),
  setMembership:         (membership)         => set({ membership }),
  setTenant:             (tenant)             => set({ tenant }),
  setAccountStatus:      (accountStatus)      => set({ accountStatus }),
  setIsSuperAdmin:       (isSuperAdmin)       => set({ isSuperAdmin }),
  setIsSuperAdminMaster: (isSuperAdminMaster) => set({ isSuperAdminMaster }),
  setLoading:            (isLoading)          => set({ isLoading }),
  setAvailableTenants:   (availableTenants)   => set({ availableTenants }),

  switchTenant: ({ tenant, membership }) => {
    localStorage.setItem('lastTenantId', tenant.id)
    set({ tenant, membership, accountStatus: membership.account_status ?? 'active' })
  },

  removeTenant: (tenantId) => {
    const remaining = useAuthStore.getState().availableTenants.filter(
      (o) => o.tenant.id !== tenantId,
    )
    if (remaining.length === 0) {
      set({ availableTenants: [] })
      return false
    }
    const next = remaining[0]
    localStorage.setItem('lastTenantId', next.tenant.id)
    set({
      availableTenants: remaining,
      tenant:           next.tenant,
      membership:       next.membership,
      accountStatus:    next.membership.account_status ?? 'active',
    })
    return true
  },

  clear: () => {
    localStorage.removeItem('lastTenantId')
    set({
      user: null, session: null, membership: null, tenant: null,
      accountStatus: null, isSuperAdmin: false, isSuperAdminMaster: false,
      isLoading: false, availableTenants: [],
    })
  },
}))
