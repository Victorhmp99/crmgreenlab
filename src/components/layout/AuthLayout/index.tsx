import { type ReactNode } from 'react'
import { useTenantStore } from '@/store/tenantStore'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const settings = useTenantStore((s) => s.settings)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo do tenant ou logo padrão */}
        <div className="flex justify-center mb-8">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-12 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-white font-semibold text-xl">DentalCRM</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white shadow-2xl p-8">{children}</div>

        <p className="text-center text-slate-400 text-xs mt-6">
          © {new Date().getFullYear()} DentalCRM · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
