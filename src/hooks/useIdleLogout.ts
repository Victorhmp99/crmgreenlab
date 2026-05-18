import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './useAuth'

interface UseIdleLogoutOptions {
  /** Tempo total de inatividade antes do logout (em minutos). Padrão: 30 */
  idleMinutes?: number
  /** Quantos minutos antes do logout mostrar o aviso. Padrão: 2 */
  warningMinutes?: number
}

/**
 * Desloga o usuário automaticamente após inatividade.
 * Eventos que resetam o timer: mousemove, mousedown, keydown, scroll, touchstart, click.
 *
 * Retorna {showWarning, secondsLeft, stayConnected} pra mostrar UI de aviso.
 */
export function useIdleLogout({
  idleMinutes    = 30,
  warningMinutes = 2,
}: UseIdleLogoutOptions = {}) {
  const { signOut, isAuthenticated } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const warnTimerRef   = useRef<number | null>(null)
  const logoutTimerRef = useRef<number | null>(null)
  const tickerRef      = useRef<number | null>(null)

  const idleMs    = idleMinutes    * 60 * 1000
  const warningMs = warningMinutes * 60 * 1000

  function clearAll() {
    if (warnTimerRef.current)   { window.clearTimeout(warnTimerRef.current);   warnTimerRef.current   = null }
    if (logoutTimerRef.current) { window.clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null }
    if (tickerRef.current)      { window.clearInterval(tickerRef.current);     tickerRef.current      = null }
  }

  const reset = useCallback(() => {
    clearAll()
    setShowWarning(false)

    if (!isAuthenticated) return

    // Timer pra mostrar o aviso (idle - warning)
    warnTimerRef.current = window.setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(Math.round(warningMs / 1000))
      // Conta regressiva visual
      tickerRef.current = window.setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
      }, 1000)
    }, idleMs - warningMs)

    // Timer pra deslogar de fato
    logoutTimerRef.current = window.setTimeout(async () => {
      clearAll()
      setShowWarning(false)
      try {
        await signOut()
      } catch {
        // Mesmo se der erro, força redirect pra login
        window.location.href = `${window.location.origin}${window.location.pathname}#/login`
      }
    }, idleMs)
  }, [isAuthenticated, idleMs, warningMs, signOut])

  // "Continuar conectado" — reseta o timer pelo botão do aviso
  const stayConnected = useCallback(() => {
    reset()
  }, [reset])

  useEffect(() => {
    if (!isAuthenticated) {
      clearAll()
      setShowWarning(false)
      return
    }

    // Inicia o timer
    reset()

    // Eventos que indicam atividade
    const events: Array<keyof WindowEventMap> = [
      'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
    ]

    // Throttle: só reseta no máximo 1x a cada 5s pra não travar com mousemove
    let lastReset = Date.now()
    const handler = () => {
      const now = Date.now()
      if (now - lastReset > 5000) {
        lastReset = now
        reset()
      }
    }

    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true }))

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler))
      clearAll()
    }
  }, [isAuthenticated, reset])

  return { showWarning, secondsLeft, stayConnected }
}
