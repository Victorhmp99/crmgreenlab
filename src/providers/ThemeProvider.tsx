import { useEffect, type ReactNode } from 'react'
import { useTenantStore } from '@/store/tenantStore'

interface ThemeProviderProps { children: ReactNode }

// Injeta as cores do tenant no :root — permite white-label por cliente
export function ThemeProvider({ children }: ThemeProviderProps) {
  const settings = useTenantStore((s) => s.settings)

  useEffect(() => {
    const root    = document.documentElement
    const primary = settings?.primary_color   ?? '#00e676'   // neon verde padrão
    const dark    = settings?.secondary_color ?? '#00c853'

    root.style.setProperty('--tenant-primary',      primary)
    root.style.setProperty('--tenant-primary-dark',  dark)
    root.style.setProperty('--tenant-primary-glow',  hexToRgba(primary, 0.25))
    root.style.setProperty('--tenant-primary-bg',    hexToRgba(primary, 0.08))
  }, [settings?.primary_color, settings?.secondary_color])

  return <>{children}</>
}

// Converte #rrggbb para rgba(r,g,b,a)
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
