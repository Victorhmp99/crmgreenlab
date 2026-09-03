import { useEffect, useState } from 'react'

/**
 * Se a tela é pequena o bastante pra barra lateral virar gaveta.
 *
 * Largura sozinha não serve: celular deitado tem 812px de largura — passa de
 * qualquer limite de "desktop" — mas só 375px de ALTURA. Tratá-lo como
 * desktop devolve 240px de menu permanente numa tela que já não tem altura
 * pra mostrar um card inteiro.
 *
 * Por isso a pergunta é largura E altura. Tablet deitado (1024x768) passa;
 * celular deitado não.
 */
const CONSULTA = '(min-width: 768px) and (min-height: 500px)'

export function useTelaCompacta(): boolean {
  const [compacta, setCompacta] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia(CONSULTA).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA)
    const aoMudar = () => setCompacta(!mq.matches)
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  return compacta
}
