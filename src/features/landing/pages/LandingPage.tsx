import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import {
  ArrowRight, Check, ChevronDown, Menu, X,
  Zap, Kanban, Wallet, Compass, Megaphone, MessageCircle,
  Workflow, Plug, ShieldCheck, BarChart3, Building2, Handshake,
  TrendingUp, LifeBuoy, Sparkles, Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PILLARS, INTEGRATIONS, FAQ, FATURAMENTO_OPTIONS } from '../content'
import { submitLandingLead, leadCaptureEnabled } from '../leadCapture'
import { CountUp, Reveal } from '../components/Motion'

const PILLAR_ICONS = [Zap, Kanban, Wallet, Compass]

const NEON = '#00e676'

/** Altura do cabeçalho fixo (h-16), descontada ao rolar até uma seção. */
const HEADER_HEIGHT = 64

/**
 * Rola até uma seção, descontando o cabeçalho fixo — sem ele o título da
 * seção para embaixo da barra.
 *
 * A rolagem é sempre um salto direto, e a suavização fica por conta do
 * `scroll-behavior: smooth` que a landing liga enquanto está montada. Assim
 * a navegação funciona mesmo onde a animação não roda (aba em segundo plano,
 * `prefers-reduced-motion`, motor sem suporte): o visitante chega na seção de
 * qualquer forma, animado ou não.
 */
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT
  window.scrollTo(0, Math.max(top, 0))
}

/**
 * Âncora interna da landing.
 *
 * O app roda em HashRouter, então um `href="#plataforma"` comum seria lido
 * como a ROTA /plataforma — que não existe e joga o visitante no login.
 * Por isso a rolagem é feita na mão, sem deixar o href mexer na URL.
 */
function AnchorLink({ to, children, className, style, onNavigate, onMouseEnter, onMouseLeave }: {
  to:            string
  children:      React.ReactNode
  className?:    string
  style?:        React.CSSProperties
  onNavigate?:   () => void
  onMouseEnter?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    scrollToSection(to)
    onNavigate?.()
  }
  return (
    <a href={`#${to}`} onClick={handleClick} className={className} style={style}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </a>
  )
}

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Suavização da rolagem só enquanto a landing está na tela — o resto do CRM
  // tem listas longas onde o salto instantâneo é o comportamento desejado.
  useEffect(() => {
    const root = document.documentElement
    const anterior = root.style.scrollBehavior
    root.style.scrollBehavior = 'smooth'
    return () => { root.style.scrollBehavior = anterior }
  }, [])

  // Quem clicou em "Criar conta" no login cai direto no formulário, em vez de
  // ter que caçar onde pedir acesso.
  const querFormulario = (location.state as { focarFormulario?: boolean } | null)?.focarFormulario
  useEffect(() => {
    if (!querFormulario) return
    // Espera o layout assentar antes de medir a posição da seção.
    const t = window.setTimeout(() => {
      // Chegada de página é salto, não animação: quem veio clicando em "Criar
      // conta" quer ver o formulário, não assistir a página deslizar. Forçar
      // `auto` também evita depender da animação, que trava sem quadros.
      const root = document.documentElement
      const anterior = root.style.scrollBehavior
      root.style.scrollBehavior = 'auto'
      scrollToSection('diagnostico')
      root.style.scrollBehavior = anterior
    }, 80)
    return () => clearTimeout(t)
  }, [querFormulario])

  // Quem já está logado não tem o que fazer na página de vendas.
  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: '#0a0a0a' }}>
      <Backdrop />

      <Nav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <main className="relative z-10">
        <Hero />
        <Stats />
        <TrustStrip />
        <Platform />
        <Integrations />
        <LeadToCash />
        <Partner />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </div>
  )
}

/* ── Fundo ─────────────────────────────────────────────────────────────────── */

function Backdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 login-grid opacity-60" />
      <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-[0.13]"
        style={{ background: '#00ff66' }} />
      <div className="absolute top-[45%] -right-40 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-[0.10]"
        style={{ background: '#00e6a8' }} />
      <div className="absolute bottom-0 left-[30%] h-[24rem] w-[24rem] rounded-full blur-3xl opacity-[0.08]"
        style={{ background: '#00c853' }} />
    </div>
  )
}

/* ── Navegação ─────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { id: 'plataforma',  label: 'Plataforma' },
  { id: 'integracoes', label: 'Integrações' },
  { id: 'parceiro',    label: 'Seja parceiro' },
  { id: 'faq',         label: 'Dúvidas' },
]

function Nav({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md"
      style={{ background: 'rgba(10,10,10,0.72)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center gap-3">
        <AnchorLink to="topo" className="flex items-center gap-2.5 shrink-0">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Green Hub" className="h-8 w-8 object-contain" />
          <span className="font-semibold tracking-tight" style={{ color: '#e8e8e8' }}>Green Hub</span>
        </AnchorLink>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV_LINKS.map((l) => (
            <AnchorLink key={l.id} to={l.id}
              className="px-3 py-2 text-sm rounded-lg transition-colors"
              style={{ color: '#9a9a9a' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e8e8e8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9a9a9a')}>
              {l.label}
            </AnchorLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/login"
            className="hidden sm:inline-flex px-4 py-2 text-sm rounded-lg transition-colors"
            style={{ color: '#c8c8c8', border: '1px solid rgba(255,255,255,0.12)' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,230,118,0.5)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}>
            Entrar
          </Link>
          <AnchorLink to="diagnostico"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-transform"
            style={{ background: NEON, color: '#04120a' }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}>
            Diagnóstico grátis
          </AnchorLink>
          <button type="button" onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg" aria-label="Menu" aria-expanded={menuOpen}
            style={{ color: '#c8c8c8' }}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden px-5 pb-4 flex flex-col gap-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {NAV_LINKS.map((l) => (
            <AnchorLink key={l.id} to={l.id} onNavigate={() => setMenuOpen(false)}
              className="px-3 py-2.5 text-sm rounded-lg" style={{ color: '#c8c8c8' }}>
              {l.label}
            </AnchorLink>
          ))}
          <Link to="/login" className="px-3 py-2.5 text-sm rounded-lg" style={{ color: '#c8c8c8' }}>
            Entrar
          </Link>
        </nav>
      )}
    </header>
  )
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */

/** Os quatro pilares técnicos, logo abaixo do título — o que sustenta a promessa. */
const HERO_PILLS = [
  { icon: Workflow,   label: 'Automações',  desc: 'O lead entra, avança e é cobrado sem ninguém lembrar' },
  { icon: Plug,       label: 'Integrações', desc: 'Meta Ads, WhatsApp e seus formulários na mesma base' },
  { icon: ShieldCheck, label: 'Seguro',      desc: 'Dados isolados por empresa, validados no banco' },
  { icon: BarChart3,  label: 'Dados',       desc: 'Cada decisão sai de número medido, não de palpite' },
]

function Hero() {
  return (
    <section id="topo" className="mx-auto max-w-6xl px-5 pt-14 pb-14 md:pt-20 md:pb-20">
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:items-start">
        {/* Coluna da mensagem */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase mb-5"
            style={{ color: NEON, opacity: 0.85 }}>
            Captar · Converter · Cobrar · Decidir
          </p>

          <h1 className="text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight"
            style={{ color: '#f2f2f2' }}>
            Seu CRM conta leads.
            <br />
            <span style={{ color: NEON }}>Este conta o caixa.</span>
          </h1>

          <p className="mt-6 text-base md:text-lg leading-relaxed" style={{ color: '#a0a0a0' }}>
            Uma plataforma que automatiza a captação, integra o que você já usa e protege seus
            dados — para transformar a operação em <span style={{ color: '#e0e0e0' }}>resultado
            medido</span>, não em achismo de reunião.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {HERO_PILLS.map((p) => (
              <div key={p.label} className="flex gap-3">
                <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)' }}>
                  <p.icon size={14} style={{ color: NEON }} />
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#e4e4e4' }}>{p.label}</p>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: '#858585' }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <AnchorLink to="plataforma"
            className="mt-9 inline-flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: '#b8b8b8' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = NEON)}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#b8b8b8')}>
            Ver tudo que a plataforma faz <ArrowRight size={15} />
          </AnchorLink>
        </div>

        {/* Coluna do formulário — na primeira dobra, sem precisar rolar */}
        <div id="diagnostico" className="lg:sticky lg:top-24">
          <LeadForm idPrefix="hero" />
        </div>
      </div>
    </section>
  )
}

/* ── Números ───────────────────────────────────────────────────────────────── */

/* Números do PRODUTO, verificáveis — não contagem de cliente. Métrica de prova
   social entra aqui quando houver dado real pra sustentar. */
const STATS = [
  { valor: 90, sufixo: ' dias', label: 'de previsão de caixa projetada', icone: TrendingUp },
  { valor: 12, sufixo: '',      label: 'métricas por campanha do Meta Ads', icone: Megaphone },
  { valor: 4,  sufixo: '',      label: 'tipos de contrato: recorrente, sem prazo, único e %', icone: Wallet },
  { valor: 60, sufixo: '+',     label: 'respostas na central de ajuda dentro do sistema', icone: LifeBuoy },
]

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16">
      <div className="grid gap-px rounded-2xl overflow-hidden sm:grid-cols-2 lg:grid-cols-4"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 70}>
            <div className="h-full px-5 py-6" style={{ background: '#0c0c0c' }}>
              <s.icone size={16} style={{ color: NEON, opacity: 0.9 }} />
              <p className="mt-3 text-3xl font-bold tracking-tight" style={{ color: '#f2f2f2' }}>
                <CountUp to={s.valor} suffix={s.sufixo} />
              </p>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: '#858585' }}>{s.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ── Faixa de confiança ────────────────────────────────────────────────────── */

function TrustStrip() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16">
      <Reveal>
        <div className="rounded-2xl px-6 py-5 md:px-8 md:py-6 flex gap-4 items-start"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)' }}>
            <Sparkles size={15} style={{ color: NEON }} />
          </span>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: '#8f8f8f' }}>
            <span style={{ color: '#e0e0e0' }}>Construído dentro de uma operação</span> que vive de
            gerar e converter lead — não num laboratório. Cada tela existe porque fez falta, não
            porque ficava bonita no roadmap.
          </p>
        </div>
      </Reveal>
    </section>
  )
}

/* ── Plataforma ────────────────────────────────────────────────────────────── */

function Platform() {
  return (
    <section id="plataforma" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <SectionHead
        eyebrow="A plataforma"
        title="Quatro coisas, sem trocar de aba"
        text="A maioria das operações usa um CRM pro funil, uma planilha pro dinheiro, o gerenciador de anúncios pro custo e o WhatsApp pessoal pro atendimento. Depois passa a segunda-feira tentando fazer os quatro baterem."
      />

      <div className="mt-14 flex flex-col gap-16">
        {PILLARS.map((pillar, i) => {
          const Icon = PILLAR_ICONS[i] ?? Zap
          return (
            <div key={pillar.id}>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.22)' }}>
                  <Icon size={16} style={{ color: NEON }} />
                </span>
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: NEON, opacity: 0.85 }}>
                  {pillar.eyebrow}
                </span>
              </div>

              <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-7"
                style={{ color: '#f0f0f0' }}>
                {pillar.title}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pillar.features.map((f, fi) => (
                  <Reveal key={f.title} delay={fi * 60}>
                    <article
                      className="h-full rounded-2xl p-5 transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0,230,118,0.32)'
                        e.currentTarget.style.transform = 'translateY(-3px)'
                        e.currentTarget.style.background = 'rgba(0,230,118,0.035)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                      }}>
                      <h4 className="text-sm font-semibold mb-2" style={{ color: '#eaeaea' }}>{f.title}</h4>
                      <p className="text-[13px] leading-relaxed" style={{ color: '#909090' }}>{f.text}</p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ── Integrações ───────────────────────────────────────────────────────────── */

function Integrations() {
  const icons = [Megaphone, MessageCircle]
  return (
    <section id="integracoes" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <SectionHead
        eyebrow="Integrações"
        title="O que já existe na sua operação, conectado"
        text="Sem exportar CSV, sem colar link em planilha, sem depender de alguém lembrar de atualizar."
      />

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {INTEGRATIONS.map((it, i) => {
          const Icon = icons[i] ?? Megaphone
          return (
            <article key={it.name} className="rounded-2xl p-7"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <Icon size={17} style={{ color: NEON }} />
                <span className="text-sm font-semibold" style={{ color: '#eaeaea' }}>{it.name}</span>
              </div>

              <h3 className="text-xl font-bold leading-snug mb-3" style={{ color: '#f0f0f0' }}>
                {it.lead}
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#909090' }}>{it.text}</p>

              <ul className="flex flex-col gap-2.5">
                {it.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: '#a8a8a8' }}>
                    <Check size={15} className="shrink-0 mt-0.5" style={{ color: NEON }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ── Do lead ao caixa ──────────────────────────────────────────────────────── */

/* Exemplo aritmeticamente consistente, rotulado como exemplo na tela:
   4.200 / 84 = CPL 50 · 6 contratos de 3.000 = 18.000 de faturamento ·
   3.000 em 12x = 250/mês · 6 × 250 = 1.500 de receita no mês. É o mesmo
   exemplo que explica por que faturamento e receita não batem. */
const CASH_FLOW = [
  { icone: Megaphone, rotulo: 'Investido no Meta Ads', valor: 4200,  prefixo: 'R$ ', nota: 'campanha do mês' },
  { icone: Users,     rotulo: 'Leads gerados',         valor: 84,    prefixo: '',     nota: 'CPL de R$ 50' },
  { icone: Handshake, rotulo: 'Contratos fechados',    valor: 6,     prefixo: '',     nota: 'R$ 3.000 cada, em 12x' },
  { icone: Wallet,    rotulo: 'Faturamento',           valor: 18000, prefixo: 'R$ ',  nota: 'a venda inteira' },
]

function LeadToCash() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <Reveal>
        <div className="rounded-3xl p-8 md:p-12"
          style={{
            background: 'linear-gradient(140deg, rgba(0,230,118,0.07), rgba(255,255,255,0.02))',
            border: '1px solid rgba(0,230,118,0.18)',
          }}>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight max-w-2xl"
            style={{ color: '#f2f2f2' }}>
            O anúncio custou R$ 4.200. E devolveu quanto?
          </h2>

          <p className="mt-5 text-base leading-relaxed max-w-2xl" style={{ color: '#a0a0a0' }}>
            É a pergunta que trava reunião. A resposta costuma ser um chute apoiado em três abas
            abertas. Aqui é uma tela — e ela mostra os dois números que ninguém separa:
          </p>

          {/* Cadeia do investimento até a venda */}
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CASH_FLOW.map((etapa, i) => (
              <Reveal key={etapa.rotulo} delay={i * 90}>
                <div className="relative h-full rounded-2xl px-5 py-5"
                  style={{ background: 'rgba(0,0,0,0.32)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <etapa.icone size={15} style={{ color: NEON, opacity: 0.9 }} />
                  <p className="mt-3 text-2xl font-bold tracking-tight" style={{ color: '#f2f2f2' }}>
                    <CountUp to={etapa.valor} prefix={etapa.prefixo} />
                  </p>
                  <p className="mt-1 text-xs font-medium" style={{ color: '#c0c0c0' }}>{etapa.rotulo}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#7d7d7d' }}>{etapa.nota}</p>

                  {/* Seta de ligação — só entre os cartões, no desktop */}
                  {i < CASH_FLOW.length - 1 && (
                    <ArrowRight size={14} aria-hidden="true"
                      className="hidden lg:block absolute top-1/2 -right-[11px] -translate-y-1/2"
                      style={{ color: 'rgba(0,230,118,0.55)' }} />
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          {/* O ponto da seção: faturamento não é receita */}
          <Reveal delay={380}>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl px-5 py-5"
                style={{ background: 'rgba(0,0,0,0.32)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: '#7d7d7d' }}>
                  Faturamento
                </p>
                <p className="mt-2 text-2xl font-bold" style={{ color: '#f2f2f2' }}>
                  <CountUp to={18000} prefix="R$ " />
                </p>
                <p className="text-xs mt-1" style={{ color: '#8a8a8a' }}>o que foi vendido, hoje</p>
              </div>
              <div className="rounded-2xl px-5 py-5"
                style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.32)' }}>
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: NEON }}>
                  Receita no mês
                </p>
                <p className="mt-2 text-2xl font-bold" style={{ color: '#f2f2f2' }}>
                  <CountUp to={1500} prefix="R$ " />
                </p>
                <p className="text-xs mt-1" style={{ color: '#8a8a8a' }}>o que efetivamente entrou</p>
              </div>
            </div>
          </Reveal>

          <p className="mt-6 text-sm leading-relaxed max-w-2xl" style={{ color: '#909090' }}>
            <span style={{ color: '#d8d8d8' }}>A diferença entre os dois é o que quebra caixa.</span>{' '}
            Seu CRM provavelmente mostra só um número — e chama de receita. Números do exemplo,
            para ilustrar o cálculo.
          </p>
        </div>
      </Reveal>
    </section>
  )
}

/* ── Parceiro ──────────────────────────────────────────────────────────────── */

function Partner() {
  return (
    <section id="parceiro" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: NEON, opacity: 0.85 }}>
            Para agências e parceiros
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-5" style={{ color: '#f0f0f0' }}>
            Revenda com a sua marca
          </h2>
          <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: '#9a9a9a' }}>
            Cada cliente entra como empresa isolada, com a identidade visual dela. Os dados são
            separados no banco de dados — não escondendo botão na tela.
          </p>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: '#9a9a9a' }}>
            Os módulos são liberados por plano: entregue funil e leads no plano de entrada e ative
            financeiro, relatórios, Meta Ads ou WhatsApp quando o cliente crescer — sem migração e
            sem perder nada do que já foi cadastrado.
          </p>
          <AnchorLink to="diagnostico"
            className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{ color: NEON, border: `1px solid rgba(0,230,118,0.4)` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,230,118,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            Quero ser parceiro <ArrowRight size={16} />
          </AnchorLink>
        </div>

        <div className="rounded-2xl p-7"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-4" style={{ color: '#777' }}>
            Liberado por plano
          </p>
          {[
            ['Automações da pipeline', 'Webhook, formulários e etapa de entrada'],
            ['Financeiro', 'Contratos, produtos, previsão e receita'],
            ['Relatórios', 'Performance e funil analítico'],
            ['Meta Ads', 'Campanhas e custo por lead'],
            ['SDR WhatsApp', 'Atendimento multi-sessão'],
          ].map(([name, desc]) => (
            <div key={name} className="flex gap-3 py-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Check size={15} className="shrink-0 mt-0.5" style={{ color: NEON }} />
              <div>
                <p className="text-sm font-medium" style={{ color: '#e0e0e0' }}>{name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7d7d7d' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── FAQ ───────────────────────────────────────────────────────────────────── */

function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <SectionHead
        eyebrow="Dúvidas"
        title="O que perguntam antes de trocar de CRM"
        text="Se a sua não estiver aqui, é só perguntar no diagnóstico."
      />

      <div className="mt-10 flex flex-col gap-2.5">
        {FAQ.map((item, i) => {
          const isOpen = open === i
          return (
            <div key={item.q} className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <button type="button" onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
                aria-expanded={isOpen}>
                <span className="flex-1 text-sm font-medium" style={{ color: '#e6e6e6' }}>{item.q}</span>
                <ChevronDown size={16} className="shrink-0 transition-transform"
                  style={{ color: '#777', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {isOpen && (
                <p className="px-5 pb-4 text-[13px] leading-relaxed" style={{ color: '#9a9a9a' }}>
                  {item.a}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ── CTA final + formulário ────────────────────────────────────────────────── */

const CTA_POINTS = [
  'Importação da base sem perder histórico',
  'Configuração acompanhada por quem opera',
  'Primeiros dados no mesmo dia',
]

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight"
            style={{ color: '#f2f2f2' }}>
            Sua operação não deveria descobrir o resultado no fim do mês.
          </h2>
          <p className="mt-5 text-base leading-relaxed" style={{ color: '#a0a0a0' }}>
            Em 20 minutos a gente olha seu funil junto e mostra onde ele está vazando — com os
            seus números, não com exemplo genérico.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {CTA_POINTS.map((p, i) => (
              <li key={p} className="flex gap-3 text-sm" style={{ color: '#c0c0c0' }}>
                <span className="h-5 w-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ background: 'rgba(0,230,118,0.12)', color: NEON }}>
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <LeadForm idPrefix="final" />
      </div>
    </section>
  )
}

/**
 * O formulário aparece duas vezes (primeira dobra e fechamento), então cada
 * instância recebe um prefixo — id repetido quebra a associação label/campo
 * e confunde leitor de tela.
 */
function LeadForm({ idPrefix }: { idPrefix: string }) {
  const [objetivo, setObjetivo]       = useState<'empresa' | 'revenda'>('empresa')
  const [nome, setNome]               = useState('')
  const [whatsapp, setWhatsapp]       = useState('')
  const [instagram, setInstagram]     = useState('')
  const [faturamento, setFaturamento] = useState('')
  const [status, setStatus]           = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [erro, setErro]               = useState('')
  const honeypot = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setErro('')
    try {
      await submitLandingLead({
        objetivo, nome, whatsapp, instagram, faturamento,
        _hp: honeypot.current?.value || undefined,
      })
      setStatus('done')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl p-8 text-center"
        style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.28)' }}>
        <div className="h-12 w-12 rounded-full mx-auto flex items-center justify-center mb-4"
          style={{ background: 'rgba(0,230,118,0.14)' }}>
          <Check size={22} style={{ color: NEON }} />
        </div>
        <p className="text-lg font-semibold mb-2" style={{ color: '#f0f0f0' }}>
          Recebemos seus dados
        </p>
        <p className="text-sm leading-relaxed" style={{ color: '#9a9a9a' }}>
          Nosso time entra em contato pelo WhatsApp para marcar uma call, entender sua operação
          e te mostrar o sistema por dentro. Depois disso você decide se faz sentido.
        </p>

        <div className="mt-6 pt-5 flex flex-col gap-2.5 text-left"
          style={{ borderTop: '1px solid rgba(0,230,118,0.2)' }}>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: NEON }}>
            Próximos passos
          </p>
          {[
            'Nosso time entra em contato pelo WhatsApp',
            'Call para entender sua operação',
            'Apresentação do sistema com os seus números',
            'Você decide, e o acesso é liberado',
          ].map((passo, i) => (
            <div key={passo} className="flex gap-2.5 items-start">
              <span className="h-5 w-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: 'rgba(0,230,118,0.14)', color: NEON }}>
                {i + 1}
              </span>
              <span className="text-[13px] leading-relaxed" style={{ color: '#a8a8a8' }}>{passo}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-7"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
      <p className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-1.5" style={{ color: NEON }}>
        Diagnóstico gratuito
      </p>
      <p className="text-sm mb-6" style={{ color: '#8f8f8f' }}>
        Preencha para receber um diagnóstico inicial da sua operação — é também por aqui que
        começa a liberação do seu acesso.
      </p>

      <div className="flex flex-col gap-4">
        {/* Separa quem quer usar de quem quer revender já na entrada: o
            atendimento dos dois é diferente e a conversa começa certa. */}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium uppercase tracking-wide mb-1.5"
            style={{ color: '#8a8a8a' }}>
            O que você procura?
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'empresa', icon: Building2, label: 'Usar na minha empresa' },
              { key: 'revenda', icon: Handshake, label: 'Revender como parceiro' },
            ] as const).map((op) => {
              const ativo = objetivo === op.key
              return (
                <button key={op.key} type="button" onClick={() => setObjetivo(op.key)}
                  aria-pressed={ativo}
                  className="flex flex-col items-start gap-1.5 rounded-xl px-3 py-3 text-left transition-colors"
                  style={{
                    background: ativo ? 'rgba(0,230,118,0.09)' : '#141414',
                    border: `1px solid ${ativo ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  }}>
                  <op.icon size={15} style={{ color: ativo ? NEON : '#777' }} />
                  <span className="text-xs font-medium leading-snug"
                    style={{ color: ativo ? '#e8e8e8' : '#9a9a9a' }}>
                    {op.label}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <Field id={`${idPrefix}-nome`} label="Nome e sobrenome" value={nome} onChange={setNome}
          placeholder="Como podemos te chamar" required autoComplete="name" />
        <Field id={`${idPrefix}-whatsapp`} label="WhatsApp" value={whatsapp} onChange={setWhatsapp}
          placeholder="(11) 99999-9999" required type="tel" autoComplete="tel" />
        <Field id={`${idPrefix}-instagram`} label="Instagram" value={instagram} onChange={setInstagram}
          placeholder="@seuperfil" />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-faturamento`} className="text-xs font-medium uppercase tracking-wide"
            style={{ color: '#8a8a8a' }}>
            {objetivo === 'revenda' ? 'Faturamento da sua agência' : 'Faturamento médio mensal'}
          </label>
          <select id={`${idPrefix}-faturamento`} value={faturamento} required
            onChange={(e) => setFaturamento(e.target.value)}
            className="h-11 rounded-lg px-3 text-sm focus:outline-none"
            style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', color: faturamento ? '#e8e8e8' : '#666' }}>
            <option value="">Selecione</option>
            {FATURAMENTO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Honeypot: fora da tela e fora da navegação por teclado. Robô preenche, gente não. */}
        <input ref={honeypot} type="text" name="_hp" tabIndex={-1} autoComplete="off"
          aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

        {status === 'error' && (
          <p className="text-xs rounded-lg px-3 py-2.5"
            style={{ color: '#ff8080', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}>
            {erro}
          </p>
        )}

        {!leadCaptureEnabled && (
          <p className="text-xs rounded-lg px-3 py-2.5"
            style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)' }}>
            Captação não configurada neste ambiente.
          </p>
        )}

        <button type="submit" disabled={status === 'sending' || !leadCaptureEnabled}
          className="h-12 rounded-xl font-semibold text-sm transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: NEON, color: '#04120a' }}>
          {status === 'sending' ? 'Enviando...' : 'Quero o diagnóstico'}
        </button>

        <p className="text-[11px] leading-relaxed text-center" style={{ color: '#6a6a6a' }}>
          Seus dados são usados só para esse contato. Nada de lista de disparo.
        </p>
      </div>
    </form>
  )
}

function Field({ id, label, value, onChange, placeholder, required, type = 'text', autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string; autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide" style={{ color: '#8a8a8a' }}>
        {label}{!required && <span style={{ color: '#5a5a5a' }}> (opcional)</span>}
      </label>
      <input id={id} type={type} value={value} required={required} placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg px-3 text-sm focus:outline-none transition-colors"
        style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', color: '#e8e8e8' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = NEON)}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
    </div>
  )
}

/* ── Comuns ────────────────────────────────────────────────────────────────── */

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-3"
        style={{ color: NEON, opacity: 0.85 }}>
        {eyebrow}
      </p>
      <h2 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight" style={{ color: '#f2f2f2' }}>
        {title}
      </h2>
      <p className="mt-4 text-sm md:text-base leading-relaxed" style={{ color: '#949494' }}>{text}</p>
    </div>
  )
}

function Footer() {
  return (
    <footer className="relative z-10 mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col md:flex-row gap-6 md:items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-2">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-7 w-7 object-contain" />
            <span className="font-semibold" style={{ color: '#d8d8d8' }}>Green Hub</span>
          </div>
          <p className="text-xs" style={{ color: '#6f6f6f' }}>
            Captação, funil, atendimento e caixa no mesmo lugar.
          </p>
        </div>

        <div className="flex flex-wrap gap-5 text-xs" style={{ color: '#7a7a7a' }}>
          <a href="/docs.html" target="_blank" rel="noopener noreferrer">Documentação</a>
          <Link to="/login">Entrar</Link>
          <AnchorLink to="diagnostico">Falar com a gente</AnchorLink>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-8">
        <p className="text-[11px]" style={{ color: '#5a5a5a' }}>
          © {new Date().getFullYear()} Green Hub. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
