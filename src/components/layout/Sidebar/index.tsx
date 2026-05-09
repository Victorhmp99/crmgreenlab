import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Kanban, Zap, Target,
  UserCog, LogOut, ChevronLeft, ChevronRight,
  DollarSign, BarChart2, Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantStore } from '@/store/tenantStore'
import { getInitials } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle:  () => void
}

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/leads',      label: 'Leads',       icon: Users           },
  { to: '/pipeline',   label: 'Pipeline',    icon: Kanban          },
  { to: '/activities', label: 'Disparos',    icon: Zap             },
  { to: '/goals',      label: 'Metas',       icon: Target          },
]

const MANAGER_ITEMS = [
  { to: '/revenue',  label: 'Financeiro',  icon: DollarSign },
  { to: '/reports',  label: 'Relatórios',  icon: BarChart2  },
  { to: '/meta-ads', label: 'Meta Ads',    icon: Megaphone  },
]

const ADMIN_ITEMS = [
  { to: '/users', label: 'Usuários', icon: UserCog },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, tenant, signOut } = useAuth()
  const { isManager, isAdmin, role } = usePermissions()
  const settings                 = useTenantStore((s) => s.settings)

  const items = [
    ...NAV_ITEMS,
    ...(isManager ? MANAGER_ITEMS : []),
    ...(isAdmin   ? ADMIN_ITEMS   : []),
  ]

  const brandName = tenant?.name ?? 'Green Hub'

  return (
    <aside className={cn(
      'relative flex flex-col h-screen border-r transition-all duration-300 ease-in-out shrink-0',
      'bg-[#080808] border-[#1e1e1e]',
      collapsed ? 'w-16' : 'w-60',
    )}>
      {/* Logo / Brand */}
      <div className={cn(
        'flex items-center h-16 border-b border-[#1e1e1e] px-4 shrink-0',
        collapsed ? 'justify-center' : 'gap-3',
      )}>
        {settings?.logo_url ? (
          <img
            src={settings.logo_url}
            alt="Logo"
            className={cn('object-contain', collapsed ? 'h-8 w-8' : 'h-8')}
          />
        ) : (
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 neon-glow"
            style={{ background: 'var(--tenant-primary)', boxShadow: '0 0 12px var(--tenant-primary-glow)' }}>
            <span className="text-black font-bold text-sm">G</span>
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-white font-bold text-sm tracking-wide truncate block">
              {brandName}
            </span>
            <span className="text-[10px] tracking-widest uppercase"
              style={{ color: 'var(--tenant-primary)' }}>
              CRM
            </span>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
                collapsed && 'justify-center',
                isActive
                  ? 'text-black'
                  : 'text-[#666666] hover:text-[#cccccc] hover:bg-[#141414]',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Fundo ativo com neon */}
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: 'var(--tenant-primary)',
                      boxShadow: '0 0 12px var(--tenant-primary-glow)',
                    }}
                  />
                )}
                <Icon
                  size={17}
                  className={cn('relative z-10 shrink-0', isActive ? 'text-black' : '')}
                />
                {!collapsed && (
                  <span className="relative z-10 truncate">{label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Separador visual para itens de admin */}
        {isManager && !collapsed && (
          <div className="mt-2 mb-1 px-3">
            <div className="h-px bg-[#1e1e1e]" />
            <span className="text-[10px] uppercase tracking-widest text-[#444] mt-2 block">Gestão</span>
          </div>
        )}
      </nav>

      {/* Usuário + logout */}
      <div className="border-t border-[#1e1e1e] p-3 flex flex-col gap-2 shrink-0">
        <div className={cn('flex items-center gap-2 px-1', collapsed && 'justify-center')}>
          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-black"
            style={{ background: 'var(--tenant-primary)' }}>
            {getInitials(user?.email ?? 'U')}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#cccccc] truncate">{user?.email}</p>
              <p className="text-[10px] capitalize" style={{ color: 'var(--tenant-primary)' }}>
                {role ?? 'usuário'}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
            'text-[#555] hover:text-red-400 hover:bg-[#1a0a0a]',
            collapsed && 'justify-center',
          )}
        >
          <LogOut size={15} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Botão colapsar */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full flex items-center justify-center z-10 border transition-colors"
        style={{
          background: '#141414',
          borderColor: '#2a2a2a',
          color: '#555',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--tenant-primary)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--tenant-primary)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#555'
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
