import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Kanban,
  Zap,
  Target,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  BarChart2,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantStore } from '@/store/tenantStore'
import { getInitials } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/leads',      label: 'Leads',        icon: Users           },
  { to: '/pipeline',   label: 'Pipeline',     icon: Kanban          },
  { to: '/activities', label: 'Disparos',     icon: Zap             },
  { to: '/goals',      label: 'Metas',        icon: Target          },
]

const managerItems = [
  { to: '/revenue',  label: 'Financeiro',  icon: DollarSign  },
  { to: '/reports',  label: 'Relatórios',  icon: BarChart2   },
  { to: '/meta-ads', label: 'Meta Ads',    icon: Megaphone   },
]

const adminItems = [
  { to: '/users', label: 'Usuários', icon: UserCog },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, tenant, signOut } = useAuth()
  const { isManager, isAdmin } = usePermissions()
  const settings = useTenantStore((s) => s.settings)

  const items = [
    ...navItems,
    ...(isManager ? managerItems : []),
    ...(isAdmin ? adminItems : []),
  ]

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-slate-900 border-r border-slate-700/50',
        'transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-slate-700/50',
          collapsed ? 'justify-center' : 'gap-3',
        )}
      >
        {settings?.logo_url ? (
          <img
            src={settings.logo_url}
            alt="Logo"
            className={cn('object-contain', collapsed ? 'h-8 w-8' : 'h-8')}
          />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">C</span>
          </div>
        )}
        {!collapsed && (
          <span className="text-white font-semibold text-sm truncate">
            {tenant?.name ?? 'DentalCRM'}
          </span>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                'transition-colors duration-150',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                collapsed && 'justify-center',
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Usuário + Logout */}
      <div className="border-t border-slate-700/50 p-3 flex flex-col gap-2">
        <div
          className={cn(
            'flex items-center gap-2 px-1',
            collapsed && 'justify-center',
          )}
        >
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <span className="text-slate-300 text-xs font-semibold">
              {getInitials(user?.email ?? 'U')}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
            'text-slate-400 hover:bg-slate-800 hover:text-white transition-colors',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Botão colapsar */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-colors z-10"
        style={{ position: 'relative', margin: '0 auto -12px', display: 'flex' }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
