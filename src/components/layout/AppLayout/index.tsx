import { useState, type ReactNode } from 'react'
import { Sidebar } from '../Sidebar'
import { Header } from '../Header'
import { useLocation } from 'react-router-dom'

interface AppLayoutProps {
  children: ReactNode
}

// Mapeamento de rota → título da página
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/leads':      'Leads',
  '/pipeline':   'Pipeline',
  '/activities': 'Disparos',
  '/goals':      'Metas',
  '/revenue':    'Revenue Center',
  '/reports':    'Relatórios',
  '/meta-ads':   'Meta Ads',
  '/users':      'Usuários',
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()

  const title = PAGE_TITLES[pathname] ?? 'CRM'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d0d0d' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main
          className={`flex-1 overflow-hidden p-6 ${pathname === '/pipeline' ? 'flex flex-col' : 'overflow-y-auto'}`}
          style={{ background: '#0d0d0d' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
