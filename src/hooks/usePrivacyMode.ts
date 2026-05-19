import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'greenhub:privacy_mode'

/**
 * Modo privacidade — esconde valores monetários e contagens sensíveis.
 * A preferência é guardada no localStorage por usuário/navegador.
 */
export function usePrivacyMode() {
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0') } catch { /* ignore */ }
  }, [hidden])

  const toggle = useCallback(() => setHidden((v) => !v), [])

  /** Esconde texto sensível com bullets quando o modo está ativo */
  const mask = useCallback((value: string | number | null | undefined, fallback = '●●●●'): string => {
    if (hidden) return fallback
    return value == null ? '—' : String(value)
  }, [hidden])

  /** Versão pra valores em moeda já formatados (mantém o R$) */
  const maskCurrency = useCallback((formatted: string, fallback = 'R$ ●●●●'): string => {
    return hidden ? fallback : formatted
  }, [hidden])

  return { hidden, toggle, mask, maskCurrency }
}
