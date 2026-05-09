import { create } from 'zustand'
import type { TenantSettings } from '@/types'

interface TenantState {
  settings: TenantSettings | null
  setSettings: (settings: TenantSettings | null) => void
}

export const useTenantStore = create<TenantState>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),
}))
