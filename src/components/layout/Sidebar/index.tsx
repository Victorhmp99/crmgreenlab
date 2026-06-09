import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Kanban, Zap, Target,
  UserCog, LogOut, ChevronLeft, ChevronRight,
  DollarSign, BarChart2, Megaphone, Settings, Globe,
  Code2, ExternalLink, Sun, Moon, CheckSquare, MessageSquare, Radar,
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/authStore'
import { useTenantStore } from '@/store/tenantStore'
import { getInitials } from '@/lib/utils'
import { TenantSwitcher } from './TenantSwitcher'
import { CreateTenantModal } from './CreateTenantModal'

interface SidebarProps {
  collapsed: boolean
  onToggle:  () => void
}

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads',      label: 'Leads',     icon: Users           },
  { to: '/pipeline',   label: 'Pipeline',  icon: Kanban          },
  { to: '/activities', label: 'Disparos',  icon: Zap             },
  { to: '/tasks',      label: 'Tarefas',   icon: CheckSquare     },
  { to: '/goals',      label: 'Metas',     icon: Target          },
]

const MANAGER_ITEMS = [
  { to: '/revenue',  label: 'Financeiro', icon: DollarSign },
  { to: '/reports',  label: 'Relatórios', icon: BarChart2  },
  { to: '/meta-ads', label: 'Meta Ads',   icon: Megaphone  },
]

const ADMIN_ITEMS = [
  { to: '/users',    label: 'Usuários',      icon: UserCog  },
  { to: '/settings', label: 'Configurações', icon: Settings },
]

const PLATFORM_ITEMS = [
  { to: '/platform', label: 'Plataforma', icon: Globe },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, tenant, signOut } = useAuth()
  const { isManager, role }       = usePermissions()
  const isSuperAdmin       = useAuthStore((s) => s.isSuperAdmin)
  const availableTenants   = useAuthStore((s) => s.availableTenants)

  // Client Radar só para o criador do sistema (super admin master)
  const isClientRadarOwner = user?.email?.toLowerCase() === 'assessoriagreenlab@gmail.com'
  const settings           = useTenantStore((s) => s.settings)
  const themeMode          = useThemeStore((s) => s.mode)
  const toggleTheme        = useThemeStore((s) => s.toggle)

  const [showCreateModal, setShowCreateModal] = useState(false)

  // Monta URL do CRC — usa Railway em produção, localhost em desenvolvimento
  const crcBase = import.meta.env.VITE_CRC_URL || 'http://localhost:3001'
  const crcUrl  = (() => {
    const ids   = availableTenants.map(o => o.tenant.id)
    const names = availableTenants.map(o => encodeURIComponent(o.tenant.name))
    const uid   = user?.id ?? ''
    if (!ids.length) return `${crcBase}?tenant_id=none&user_id=${uid}`
    return `${crcBase}?tenant_id=${ids.join(',')}&tenant_names=${names.join(',')}&user_id=${uid}`
  })()

  // Manager e Admin têm acesso a Usuários e Configurações (isManager === role >= manager)
  const items = [
    ...NAV_ITEMS,
    ...(isManager    ? MANAGER_ITEMS  : []),
    ...(isManager    ? ADMIN_ITEMS    : []),
    ...(isSuperAdmin ? PLATFORM_ITEMS : []),
  ]

  return (
    <>
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
            <img src={settings.logo_url} alt="Logo"
              className={cn('object-contain', collapsed ? 'h-8 w-8' : 'h-8')} />
          ) : (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--tenant-primary)', boxShadow: '0 0 12px var(--tenant-primary-glow)' }}>
              <span className="text-black font-bold text-sm">G</span>
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-white font-bold text-sm tracking-wide truncate block">{tenant?.name ?? 'Green Hub'}</span>
              <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--tenant-primary)' }}>
                CRM
              </span>
            </div>
          )}
        </div>

        {/* Switcher de empresa — logo abaixo do header */}
        <div className={cn('px-2 pt-3', collapsed && 'flex justify-center')}>
          <TenantSwitcher
            collapsed={collapsed}
            onCreateTenant={() => setShowCreateModal(true)}
          />
        </div>

        {/* Navegação */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) => cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
                collapsed && 'justify-center',
                isActive ? 'text-black' : 'text-[#666666] hover:text-[#cccccc] hover:bg-[#141414]',
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-lg" style={{
                      background: to === '/platform' ? '#a78bfa' : 'var(--tenant-primary)',
                      boxShadow: to === '/platform'
                        ? '0 0 12px rgba(167,139,250,0.3)'
                        : '0 0 12px var(--tenant-primary-glow)',
                    }} />
                  )}
                  <Icon size={17} className={cn('relative z-10 shrink-0', isActive ? 'text-black' : '')} />
                  {!collapsed && <span className="relative z-10 truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}

          {isManager && !collapsed && (
            <div className="mt-2 mb-1 px-3">
              <div className="h-px bg-[#1e1e1e]" />
              <span className="text-[10px] uppercase tracking-widest text-[#444] mt-2 block">Gestão</span>
            </div>
          )}

          {isSuperAdmin && !collapsed && (
            <div className="mt-2 mb-1 px-3">
              <div className="h-px bg-[#1e1e1e]" />
              <span className="text-[10px] uppercase tracking-widest mt-2 block" style={{ color: '#a78bfa' }}>
                Super Admin
              </span>
            </div>
          )}

          {/* SDR WhatsApp — abre com todos os tenants do usuário */}
          <a
            href={crcUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'SDR WhatsApp' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group mt-0.5',
              collapsed && 'justify-center',
              'text-[#666666] hover:text-[#cccccc] hover:bg-[#141414]',
            )}
          >
            <MessageSquare size={17} className="relative z-10 shrink-0" />
            {!collapsed && (
              <>
                <span className="relative z-10 truncate flex-1">SDR WhatsApp</span>
                <ExternalLink size={11} className="relative z-10 shrink-0 opacity-60" />
              </>
            )}
          </a>

          {/* Scripts — link externo, visível para TODOS os usuários */}
          <a
            href="https://scripts.assessoriagreenlab.com.br/#/login"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Scripts' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group mt-0.5',
              collapsed && 'justify-center',
              'text-[#666666] hover:text-[#cccccc] hover:bg-[#141414]',
            )}
          >
            <Code2 size={17} className="relative z-10 shrink-0" />
            {!collapsed && (
              <>
                <span className="relative z-10 truncate flex-1">Scripts</span>
                <ExternalLink size={11} className="relative z-10 shrink-0 opacity-60" />
              </>
            )}
          </a>

          {/* Client Radar — link externo, SOMENTE para o criador (assessoriagreenlab@gmail.com) */}
          {isClientRadarOwner && (
            <a
              href="https://victorhmp99.github.io/business-health/"
              target="_blank"
              rel="noopener noreferrer"
              title={collapsed ? 'Client Radar' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group mt-0.5',
                collapsed && 'justify-center',
                'text-[#666666] hover:text-[#cccccc] hover:bg-[#141414]',
              )}
            >
              <Radar size={17} className="relative z-10 shrink-0" />
              {!collapsed && (
                <>
                  <span className="relative z-10 truncate flex-1">Client Radar</span>
                  <ExternalLink size={11} className="relative z-10 shrink-0 opacity-60" />
                </>
              )}
            </a>
          )}
        </nav>

        {/* Usuário + logout */}
        <div className="border-t border-[#1e1e1e] p-3 flex flex-col gap-2 shrink-0">
          <div className={cn('flex items-center gap-2 px-1', collapsed && 'justify-center')}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-black"
              style={{ background: isSuperAdmin ? '#a78bfa' : 'var(--tenant-primary)' }}>
              {getInitials(user?.email ?? 'U')}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#cccccc] truncate">{user?.email}</p>
                <p className="text-[10px] capitalize"
                  style={{ color: isSuperAdmin ? '#a78bfa' : 'var(--tenant-primary)' }}>
                  {isSuperAdmin ? 'super admin' : (role ?? 'usuário')}
                </p>
              </div>
            )}
          </div>

          {/* Toggle de tema */}
          <button
            onClick={toggleTheme}
            title={collapsed ? (themeMode === 'dark' ? 'Modo claro' : 'Modo escuro') : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              'text-[#555] hover:text-[#ccc] hover:bg-[#141414]',
              collapsed && 'justify-center',
            )}
          >
            {themeMode === 'dark'
              ? <Sun size={15} className="shrink-0" />
              : <Moon size={15} className="shrink-0" />}
            {!collapsed && <span>{themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>}
          </button>

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
          style={{ background: '#141414', borderColor: '#2a2a2a', color: '#555' }}
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

      {/* Modal de criação de empresa */}
      {showCreateModal && (
        <CreateTenantModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  )
}
