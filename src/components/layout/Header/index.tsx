import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/lib/utils'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth()

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Busca rápida (placeholder para Fase 2) */}
        <button className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
          <Search size={16} />
        </button>

        {/* Notificações (placeholder) */}
        <button className="relative h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
          <Bell size={16} />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
            0
          </span>
        </button>

        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-semibold">
            {getInitials(user?.email ?? 'U')}
          </span>
        </div>
      </div>
    </header>
  )
}
