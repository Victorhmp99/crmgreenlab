import { createPortal } from 'react-dom'
import { Clock, LogOut } from 'lucide-react'
import { useIdleLogout } from '@/hooks/useIdleLogout'

/**
 * Wrapper que ativa o auto-logout por inatividade e mostra um modal de aviso
 * pouco antes do logout para o usuário poder continuar conectado.
 */
export function IdleWarning() {
  const { showWarning, secondsLeft, stayConnected } = useIdleLogout({
    idleMinutes:    30,  // logout após 30 min de inatividade
    warningMinutes: 2,   // aviso 2 min antes
  })

  if (!showWarning) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: '#0f0f0f',
          border: '1px solid rgba(251,191,36,0.35)',
          boxShadow: '0 0 60px rgba(251,191,36,0.15)',
        }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(251,191,36,0.15)' }}>
            <Clock size={20} style={{ color: '#fbbf24' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: '#e8e8e8' }}>
              Você ainda está aí?
            </h3>
            <p className="text-sm mt-0.5" style={{ color: '#888' }}>
              Sua sessão expira por inatividade.
            </p>
          </div>
        </div>

        <div className="rounded-xl p-4 flex flex-col items-center"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-[11px] uppercase tracking-widest" style={{ color: '#666' }}>
            Desconectando em
          </p>
          <p className="text-4xl font-black tabular-nums mt-1"
            style={{ color: secondsLeft <= 30 ? '#ff4444' : '#fbbf24' }}>
            {timeStr}
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={stayConnected}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{
              background: 'var(--tenant-primary)',
              color: '#000',
            }}>
            Continuar conectado
          </button>
          <button onClick={() => { window.location.href = `${window.location.origin}${window.location.pathname}#/login` }}
            className="rounded-lg px-3 py-2.5 text-sm transition-colors inline-flex items-center gap-1.5"
            style={{ color: '#aaa', border: '1px solid #2a2a2a' }}>
            <LogOut size={13} /> Sair agora
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
