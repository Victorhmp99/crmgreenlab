import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useTelaCompacta } from '@/hooks/useTelaCompacta'
import { Sidebar } from '../Sidebar'
import { Header } from '../Header'
import { useLocation } from 'react-router-dom'
import { NotificationToaster } from '@/features/notifications/components/NotificationToaster'

interface AppLayoutProps {
  children: ReactNode
}

// Mapeamento de rota → título da página
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/leads':      'Leads',
  '/pipeline':   'Pipeline',
  '/activities': 'Movimentações',
  '/goals':      'Metas',
  '/ajuda':      'Central de Ajuda',
  '/revenue':    'Revenue Center',
  '/reports':    'Relatórios',
  '/meta-ads':   'Meta Ads',
  '/users':      'Usuários',
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()

  /* No celular a barra lateral não pode ocupar espaço: 240px de menu num
     aparelho de 375px deixa 135px pra trabalhar. Ela vira gaveta — sai da
     frente e entra por cima quando chamada. */
  const [menuAberto, setMenuAberto] = useState(false)
  const compacta = useTelaCompacta()

  // Fecha ao trocar de página: gaveta que fica aberta por cima do destino é
  // um clique a mais em cada navegação. Ajuste no render em vez de efeito,
  // como no resto do projeto.
  const [rotaAnterior, setRotaAnterior] = useState(pathname)
  if (rotaAnterior !== pathname) {
    setRotaAnterior(pathname)
    setMenuAberto(false)
  }

  const title = PAGE_TITLES[pathname] ?? (pathname.startsWith('/ajuda/') ? 'Central de Ajuda' : 'CRM')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <NotificationToaster />

      {/* Fundo escuro: fechar tocando fora é o gesto que todo mundo tenta
          primeiro. Sem ele, a única saída seria achar o X. */}
      {menuAberto && compacta && (
        <div
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          aria-hidden
        />
      )}

      <div className={cn(
        'transition-transform duration-200 ease-out',
        compacta
          ? cn('fixed inset-y-0 left-0 z-40', menuAberto ? 'translate-x-0' : '-translate-x-full')
          : 'static z-auto translate-x-0',
      )}>
        {/* No celular a gaveta abre sempre inteira: menu de 64px com só ícones
            é adivinhação em tela pequena. */}
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} onAbrirMenu={compacta ? () => setMenuAberto(true) : undefined} />
        <main
          className={cn(
            // 24px de padding em cada lado custa 48px de largura útil no
            // celular — no quadro isso é meia coluna.
            'flex-1 overflow-hidden p-3 sm:p-6',
            pathname === '/pipeline' ? 'flex flex-col' : 'overflow-y-auto',
          )}
          style={{ background: 'var(--bg)' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
