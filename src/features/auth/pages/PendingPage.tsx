import { Clock, LogOut, Mail } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export function PendingPage() {
  const { user, signOut } = useAuth()

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center gap-5 py-4">
        {/* Ícone */}
        <div className="h-16 w-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <Clock size={30} style={{ color: '#fbbf24' }} />
        </div>

        {/* Texto */}
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>
            Conta aguardando aprovação
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#666' }}>
            Sua conta foi criada com sucesso e está em análise.
            Um administrador irá ativá-la em breve.
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
          style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}>
          <p className="font-medium mb-1" style={{ color: '#888' }}>O que acontece agora?</p>
          <ul className="flex flex-col gap-1 list-disc list-inside">
            <li>O administrador da plataforma foi notificado</li>
            <li>Você receberá acesso assim que a conta for aprovada</li>
            <li>Caso precise de urgência, entre em contato diretamente</li>
          </ul>
        </div>

        {/* Ação */}
        <Button variant="ghost" onClick={signOut} className="w-full">
          <LogOut size={15} />
          Sair da conta
        </Button>
      </div>
    </AuthLayout>
  )
}
