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
    // Persiste escolha para próximo login
    localStorage.setItem('lastTenantId', tenant.id)
    set({
      tenant,
      membership,
      accountStatus: membership.account_status ?? 'active',
    })
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
