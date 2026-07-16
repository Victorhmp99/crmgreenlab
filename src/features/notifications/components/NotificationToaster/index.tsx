import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { fetchMyNotifications, markAsRead } from '@/services/notifications'
import type { Notification } from '@/services/notifications'

/**
 * Mostra as notificações não lidas como pop-up no MEIO da tela — assim que a
 * pessoa entra no CRM (se já tiver alguma pendente) e também quando uma nova
 * chega em tempo real enquanto ela está usando o sistema. Monte uma vez em
 * AppLayout.
 */
export function NotificationToaster() {
  const userId = useAuthStore((s) => s.user?.id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [queue,   setQueue]   = useState<Notification[]>([])
  const [current, setCurrent] = useState<Notification | null>(null)

  // Ao entrar no CRM: busca notificações não lidas e já mostra a primeira.
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    fetchMyNotifications()
      .then((all) => {
        if (cancelled) return
        const unread = all.filter((n) => !n.read_at).reverse() // mais antiga primeiro
        if (unread.length === 0) return
        setCurrent(unread[0])
        setQueue(unread.slice(1))
      })
      .catch(() => {}) // silencioso — não bloqueia o uso do CRM

    return () => { cancelled = true }
  }, [userId])

  // Enquanto estiver logado: escuta novas notificações em tempo real.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-popup:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as Notification
          setCurrent((prevCurrent) => {
            if (prevCurrent) {
              setQueue((prevQueue) => [...prevQueue, notif])
              return prevCurrent
            }
            return notif
          })
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, queryClient])

  async function dismiss() {
    if (!current) return
    const id = current.id
    setCurrent(queue[0] ?? null)
    setQueue((prev) => prev.slice(1))
    try {
      await markAsRead(id)
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    } catch { /* já sai da fila mesmo se o markAsRead falhar */ }
  }

  function handlePrimaryClick() {
    if (current?.link) navigate(current.link)
    dismiss()
  }

  if (!current) return null

  const remaining = queue.length

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 flex flex-col items-center text-center gap-3"
        style={{
          background: '#111111',
          border: '1px solid rgba(0,230,118,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        <button
          onClick={dismiss}
          title="Fechar"
          className="absolute top-3 right-3 h-6 w-6 rounded flex items-center justify-center transition-colors"
          style={{ color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
        >
          <X size={13} />
        </button>

        <div className="h-12 w-12 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(0,230,118,0.12)' }}>
          <Bell size={22} style={{ color: '#00e676' }} />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold" style={{ color: '#e8e8e8' }}>
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#999' }}>
            {current.body}
          </p>
        </div>

        {remaining > 0 && (
          <p className="text-[11px]" style={{ color: '#555' }}>
            +{remaining} {remaining === 1 ? 'notificação' : 'notificações'} depois desta
          </p>
        )}

        <button
          onClick={handlePrimaryClick}
          className="mt-1 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity"
          style={{ background: 'var(--tenant-primary, #00e676)', color: '#04130b' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {current.link ? 'Ver detalhes' : remaining > 0 ? 'Marcar como lida' : 'Entendi'}
        </button>
      </div>
    </div>
  )
}
