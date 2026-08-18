import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * Movimento da landing.
 *
 * Princípio destes componentes: o estado FINAL é o padrão do render. A
 * animação só acontece se o navegador realmente entregar frames. Assim, se
 * o JS falhar, a aba estiver em segundo plano ou a pessoa pedir menos
 * movimento, o conteúdo aparece inteiro — nunca invisível ou zerado.
 * O inverso (começar escondido e revelar por JS) é o que produz aquela
 * página em branco quando algo dá errado.
 */

function prefereMenosMovimento(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Dispara uma vez, quando o elemento entra na tela. */
function useEntrouNaTela<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisivel(true); return }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisivel(true)
          obs.disconnect()
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )
    obs.observe(el)

    // Rede de segurança: em contextos que não compõem quadros o observer
    // pode nunca disparar, e aí o conteúdo ficaria escondido pra sempre.
    // Passado esse tempo, mostramos de qualquer jeito.
    const resgate = window.setTimeout(() => setVisivel(true), 1200)

    return () => { obs.disconnect(); clearTimeout(resgate) }
  }, [])

  return { ref, visivel }
}

/**
 * Número que sobe até o valor final.
 *
 * Renderiza o valor final de saída; só volta pro zero e anima quando o
 * elemento aparece na tela e há frames disponíveis.
 */
export function CountUp({ to, suffix = '', prefix = '', duration = 1400, className, style }: {
  to:        number
  suffix?:   string
  prefix?:   string
  duration?: number
  className?: string
  style?:    React.CSSProperties
}) {
  const { ref, visivel } = useEntrouNaTela<HTMLSpanElement>()
  const [valor, setValor] = useState(to)

  useEffect(() => {
    if (!visivel || prefereMenosMovimento()) return

    let raf = 0
    let comecou = false
    const inicio = performance.now()

    function passo(agora: number) {
      const t = Math.min((agora - inicio) / duration, 1)
      // Na primeira chamada real de frame é que zeramos: se rAF nunca
      // rodar, o número simplesmente permanece no valor final.
      if (!comecou) comecou = true
      const suavizado = 1 - Math.pow(1 - t, 3)
      setValor(Math.round(to * suavizado))
      if (t < 1) raf = requestAnimationFrame(passo)
    }

    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [visivel, to, duration])

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}{valor.toLocaleString('pt-BR')}{suffix}
    </span>
  )
}

/**
 * Entrada suave ao rolar.
 *
 * O elemento é sempre renderizado visível; ao entrar na tela ganha uma classe
 * que dispara um `@keyframes` (sem fill-mode). Isso é diferente de esconder e
 * revelar por transição: transição parada deixa o conteúdo preso em opacity 0
 * quando o navegador não desenha quadros. Aqui, animação que não roda apenas
 * não aparece — o conteúdo continua lá.
 */
export function Reveal({ children, delay = 0, className }: {
  children:  ReactNode
  delay?:    number
  className?: string
}) {
  const { ref, visivel } = useEntrouNaTela<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={[className, visivel ? 'landing-reveal' : ''].filter(Boolean).join(' ')}
      style={visivel && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
