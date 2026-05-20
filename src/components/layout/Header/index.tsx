import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Bell, Settings as SettingsIcon, LogOut, Check, Mail, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { getInitials } from '@/lib/utils'
import {
  useMyNotifications, useNotificationMutations,
} from '@/features/notifications/hooks/useNotifications'
import type { Notification as AppNotification } from '@/services/notifications'

interface HeaderProps { title: string }

export function Header({ title }: HeaderProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const membership = useAuthStore((s) => s.membership)

  const [bellOpen,    setBellOpen]    = useState<DOMRect | null>(null)
  const [profileOpen, setProfileOpen] = useState<DOMRect | null>(null)

  // useQuery captura erros (ex: tabela notifications inexistente) silenciosamente
  const { data: notifications = [] } = useMyNotifications()
  const unreadCount = notifications.filter((n) => !n.read_at).length

  function handleBellClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setProfileOpen(null)
    setBellOpen((prev) => (prev ? null : rect))
  }

  function handleProfileClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setBellOpen(null)
    setProfileOpen((prev) => (prev ? null : rect))
  }

  async function handleSignOut() {
    setProfileOpen(null)
    try { await signOut() } catch { /* ignore */ }
    navigate('/login')
  }

  return (
    <header className="h-16 border-b flex items-center justify-between px-6 shrink-0 relative z-10"
      style={{ background: '#0d0d0d', borderColor: '#1e1e1e' }}>
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-wide" style={{ color: '#e8e8e8' }}>
          {title}
        </h1>
        <span className="h-1 w-1 rounded-full" style={{ background: 'var(--tenant-primary)' }} />
      </div>

      <div className="flex items-center gap-2">
        {/* Sino */}
        <button
          type="button"
          onClick={handleBellClick}
          title="Notificações"
          className="relative h-9 w-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer"
          style={{ background: '#141414', borderColor: '#2a2a2a', color: '#888' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--tenant-primary)'; e.currentTarget.style.color = '#e8e8e8' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#888' }}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] flex items-center justify-center font-bold text-black"
              style={{ background: 'var(--tenant-primary)' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <button
          type="button"
          onClick={handleProfileClick}
          title="Minha conta"
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-black transition-transform hover:scale-105 cursor-pointer"
          style={{ background: 'var(--tenant-primary)', boxShadow: '0 0 8px var(--tenant-primary-glow)' }}
        >
          {getInitials(user?.email ?? 'U')}
        </button>
      </div>

      {bellOpen && (
        <BellDropdown
          anchorRect={bellOpen}
          notifications={notifications}
          onClose={() => setBellOpen(null)}
        />
      )}

      {profileOpen && (
        <ProfileDropdown
          anchorRect={profileOpen}
          email={user?.email ?? ''}
          role={membership?.role ?? null}
          onClose={() => setProfileOpen(null)}
          onSettings={() => { setProfileOpen(null); navigate('/settings') }}
          onSignOut={handleSignOut}
        />
      )}
    </header>
  )
}

// ── Dropdown do sino ─────────────────────────────────────────────────────────

function BellDropdown({ anchorRect, notifications, onClose }: {
  anchorRect:    DOMRect
  notifications: AppNotification[]
  onClose:       () => void
}) {
  const { read, readAll, remove, clearAll } = useNotificationMutations()
  const top  = anchorRect.bottom + 6
  const left = Math.max(8, anchorRect.right - 360)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div className="fixed z-[9999] rounded-xl flex flex-col"
        style={{
          top, left, width: 360, maxHeight: 480,
          background: '#0f0f0f',
          border: '1px solid #2a2a2a',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}>

        <div className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid #1e1e1e' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
            Notificações
          </h3>
          <div className="flex items-center gap-1">
            {notifications.some((n) => !n.read_at) && (
              <button onClick={() => readAll.mutate()}
                title="Marcar todas como lidas"
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: '#aaa' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <Check size={12} className="inline mr-1" />
                Marcar lidas
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={() => clearAll.mutate()}
                title="Limpar todas"
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: '#ff4444' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-14 w-14 rounded-full flex items-center justify-center"
                style={{ background: '#1a1a1a' }}>
                <Bell size={22} style={{ color: '#333' }} />
              </div>
              <p className="text-sm" style={{ color: '#666' }}>Sem notificações</p>
              <p className="text-xs" style={{ color: '#444' }}>Você receberá avisos importantes por aqui</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id}
                className="px-4 py-3 group transition-colors flex items-start gap-2 cursor-pointer"
                style={{
                  borderBottom: '1px solid #161616',
                  background: n.read_at ? 'transparent' : 'rgba(0,230,118,0.04)',
                }}
                onClick={() => !n.read_at && read.mutate(n.id)}>
                {!n.read_at && (
                  <span className="h-2 w-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: 'var(--tenant-primary)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
                      {n.title}
                    </p>
                    <span className="text-[10px] whitespace-nowrap" style={{ color: '#555' }}>
                      {formatRelative(n.created_at)}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 whitespace-pre-wrap leading-relaxed" style={{ color: '#aaa' }}>
                    {n.body}
                  </p>
                  {n.link && (
                    <a href={n.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs mt-1 inline-block underline"
                      style={{ color: 'var(--tenant-primary)' }}>
                      Abrir →
                    </a>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); remove.mutate(n.id) }}
                  title="Excluir"
                  className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#555' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── Dropdown do perfil ──────────────────────────────────────────────────────

function ProfileDropdown({ anchorRect, email, role, onClose, onSettings, onSignOut }: {
  anchorRect: DOMRect
  email:      string
  role:       string | null
  onClose:    () => void
  onSettings: () => void
  onSignOut:  () => void
}) {
  const top  = anchorRect.bottom + 6
  const left = Math.max(8, anchorRect.right - 260)
  const name = email.split('@')[0]?.replace(/[._-]/g, ' ') ?? 'Usuário'
  const roleLabel =
    role === 'admin'   ? 'Admin' :
    role === 'manager' ? 'Gestor' :
    role === 'seller'  ? 'Vendedor' :
    'Usuário'

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div className="fixed z-[9999] rounded-xl"
        style={{
          top, left, width: 260,
          background: '#0f0f0f',
          border: '1px solid #2a2a2a',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}>

        <div className="px-4 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
              style={{ background: 'var(--tenant-primary)' }}>
              {getInitials(email)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize truncate" style={{ color: '#e8e8e8' }}>
                {name}
              </p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--tenant-primary)' }}>
                {roleLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#888' }}>
            <Mail size={11} />
            <span className="truncate">{email}</span>
          </div>
        </div>

        <div className="py-1">
          <button type="button" onClick={onSettings}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors cursor-pointer"
            style={{ color: '#aaa' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <SettingsIcon size={14} /> Configurações
          </button>
          <button type="button" onClick={onSignOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors cursor-pointer"
            style={{ color: '#ff4444' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60)  return `há ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60)  return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)   return `há ${d}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
