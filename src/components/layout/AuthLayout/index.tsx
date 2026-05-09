import { type ReactNode } from 'react'
import { useTenantStore } from '@/store/tenantStore'

interface AuthLayoutProps { children: ReactNode }

export function AuthLayout({ children }: AuthLayoutProps) {
  const settings = useTenantStore((s) => s.settings)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 tech-grid relative overflow-hidden"
      style={{ background: '#080808' }}>
      {/* Orbs neon de fundo */}
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'var(--tenant-primary)' }} />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full opacity-5 blur-3xl pointer-events-none"
        style={{ background: 'var(--tenant-primary)' }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}
        <div className="flex justify-center mb-8">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-14 object-contain" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center text-black font-black text-xl neon-glow"
                style={{ background: 'var(--tenant-primary)' }}>
                G
              </div>
              <div>
                <p className="text-white font-black text-2xl tracking-tight leading-none">
                  Green<span style={{ color: 'var(--tenant-primary)' }}>Hub</span>
                </p>
                <p className="text-[11px] tracking-widest uppercase" style={{ color: 'var(--tenant-primary)', opacity: 0.7 }}>
                  CRM Platform
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Card de formulário */}
        <div className="rounded-2xl p-8 border"
          style={{ background: '#111111', borderColor: '#2a2a2a' }}>
          {children}
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: '#444' }}>
          © {new Date().getFullYear()} Green Hub · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
