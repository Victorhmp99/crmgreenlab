import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchMyNotifications, markAsRead, markAllAsRead,
  deleteNotification, clearAllNotifications,
  sendNotification, broadcastNotification,
} from '@/services/notifications'

export function useMyNotifications() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey:  ['notifications', userId],
    queryFn:   async () => {
      try { return await fetchMyNotifications() }
      catch (e) {
        // Se a tabela ainda não existir, retorna array vazio em vez de propagar erro
        console.warn('[notifications] fetch falhou (rode supabase/notifications.sql):', e)
        return []
      }
    },
    enabled:   !!userId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: false,
  })
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] })

  const read = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: invalidate,
  })

  const readAll = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: invalidate,
  })

  const clearAll = useMutation({
    mutationFn: () => clearAllNotifications(),
    onSuccess: invalidate,
  })

  const send = useMutation({
    mutationFn: ({ recipientIds, title, body, link }: {
      recipientIds: string[]; title: string; body: string; link?: string | null
    }) => sendNotification(recipientIds, title, body, link),
  })

  const broadcast = useMutation({
    mutationFn: ({ title, body, link }: { title: string; body: string; link?: string | null }) =>
      broadcastNotification(title, body, link),
  })

  return { read, readAll, remove, clearAll, send, broadcast }
}
