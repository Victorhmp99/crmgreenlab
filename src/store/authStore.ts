import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { UserMembership, Tenant } from '@/types'

interface AuthState {
  user:          User | null
  session:       Session | null
  membership:    UserMembership | null
  tenant:        Tenant | null
  isSuperAdmin:  boolean
  isLoading:     boolean
  setUser:         (user: User | null) => void
  setSession:      (session: Session | null) => void
  setMembership:   (membership: UserMembership | null) => void
  setTenant:       (tenant: Tenant | null) => void
  setIsSuperAdmin: (v: boolean) => void
  setLoading:      (isLoading: boolean) => void
  clear:           () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:         null,
  session:      null,
  membership:   null,
  tenant:       null,
  isSuperAdmin: false,
  isLoading:    true,

  setUser:         (user)         => set({ user }),
  setSession:      (session)      => set({ session }),
  setMembership:   (membership)   => set({ membership }),
  setTenant:       (tenant)       => set({ tenant }),
  setIsSuperAdmin: (isSuperAdmin) => set({ isSuperAdmin }),
  setLoading:      (isLoading)    => set({ isLoading }),

  clear: () => set({
    user: null, session: null, membership: null,
    tenant: null, isSuperAdmin: false, isLoading: false,
  }),
}))
