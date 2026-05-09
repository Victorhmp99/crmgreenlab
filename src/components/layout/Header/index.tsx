import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/lib/utils'

interface HeaderProps { title: string }

export function Header({ title }: HeaderProps) {
  const { user } = useAuth()

  return (
    <header className="h-16 border-b flex items-center justify-between px-6 shrink-0"
      style={{ background: '#0d0d0d', borderColor: '#1e1e1e' }}>
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-wide" style={{ color: '#e8e8e8' }}>
          {title}
        </h1>
        {/* Detalhe decorativo neon */}
        <span className="h-1 w-1 rounded-full" style={{ background: 'var(--tenant-primary)' }} />
      </div>

      <div className="flex items-center gap-2">
        <button className="h-9 w-9 rounded-lg border flex items-center justify-center transition-colors"
          style={{ background: '#141414', borderColor: '#2a2a2a', color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--tenant-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
        >
          <Search size={15} />
        </button>

        <button className="relative h-9 w-9 rounded-lg border flex items-center justify-center transition-colors"
          style={{ background: '#141414', borderColor: '#2a2a2a', color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--tenant-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
        >
          <Bell size={15} />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-[10px] flex items-center justify-center font-bold text-black"
            style={{ background: 'var(--tenant-primary)' }}>
            0
          </span>
        </button>

        {/* Avatar */}
        <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-black"
          style={{ background: 'var(--tenant-primary)', boxShadow: '0 0 8px var(--tenant-primary-glow)' }}>
          {getInitials(user?.email ?? 'U')}
        </div>
      </div>
    </header>
  )
}
