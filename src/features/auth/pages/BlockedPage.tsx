import { ShieldOff, LogOut, Mail } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export function BlockedPage() {
  const { user, signOut } = useAuth()

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center gap-5 py-4">
        {/* Ícone */}
        <div className="h-16 w-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)' }}>
          <ShieldOff size={30} style={{ color: '#ff4444' }} />
        </div>

        {/* Texto */}
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>
            Conta bloqueada
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#666' }}>
            Sua conta foi bloqueada pelo administrador da plataforma
            e não tem acesso ao sistema no momento.
          </p>
          {user?.email && (
            <div className="flex items-center justify-center gap-2 mt-1 rounded-lg px-3 py-2"
              style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
              <Mail size={13} style={{ color: '#555' }} />
              <span className="text-xs" style={{ color: '#888' }}>{user.email}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="rounded-xl px-4 py-3 text-xs text-left w-full"
          style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.1)', color: '#666' }}>
          Se você acredita que isso é um erro, entre em contato com o suporte
          da plataforma para resolver a situação.
        </div>

        <Button variant="ghost" onClick={signOut} className="w-full">
          <LogOut size={15} />
          Sair da conta
        </Button>
      </div>
    </AuthLayout>
  )
}
