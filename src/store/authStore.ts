import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { UserMembership, Tenant, AccountStatus } from '@/types'

interface AuthState {
  user:               User | null
  session:            Session | null
  membership:         UserMembership | null
  tenant:             Tenant | null
  accountStatus:      AccountStatus | null
  isSuperAdmin:       boolean   // true para master e auxiliary
  isSuperAdminMaster: boolean   // true somente para master
  isLoading:          boolean

  setUser:               (user: User | null) => void
  setSession:            (session: Session | null) => void
  setMembership:         (membership: UserMembership | null) => void
  setTenant:             (tenant: Tenant | null) => void
  setAccountStatus:      (status: AccountStatus | null) => void
  setIsSuperAdmin:       (v: boolean) => void
  setIsSuperAdminMaster: (v: boolean) => void
  setLoading:            (isLoading: boolean) => void
  clear:                 () => void
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

  setUser:               (user)               => set({ user }),
  setSession:            (session)            => set({ session }),
  setMembership:         (membership)         => set({ membership }),
  setTenant:             (tenant)             => set({ tenant }),
  setAccountStatus:      (accountStatus)      => set({ accountStatus }),
  setIsSuperAdmin:       (isSuperAdmin)       => set({ isSuperAdmin }),
  setIsSuperAdminMaster: (isSuperAdminMaster) => set({ isSuperAdminMaster }),
  setLoading:            (isLoading)          => set({ isLoading }),

  clear: () => set({
    user: null, session: null, membership: null, tenant: null,
    accountStatus: null, isSuperAdmin: false, isSuperAdminMaster: false,
    isLoading: false,
  }),
}))
