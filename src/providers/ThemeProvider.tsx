import { useEffect, type ReactNode } from 'react'
import { useTenantStore } from '@/store/tenantStore'

interface ThemeProviderProps {
  children: ReactNode
}

// Injeta as cores do tenant como CSS variables no :root
export function ThemeProvider({ children }: ThemeProviderProps) {
  const settings = useTenantStore((s) => s.settings)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--tenant-primary', settings?.primary_color ?? '#2563EB')
    root.style.setProperty('--tenant-primary-dark', settings?.secondary_color ?? '#1E40AF')
  }, [settings?.primary_color, settings?.secondary_color])

  return <>{children}</>
}
