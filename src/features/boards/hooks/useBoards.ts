import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { fetchBoards, fetchBoardFull, fetchCardDetail, fetchMembros } from '@/services/boards'

export function useBoards() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['boards', tenantId],
    queryFn:  () => fetchBoards(tenantId!),
    enabled:  !!tenantId,
  })
}

/**
 * Quadro completo + realtime. Duas pessoas no mesmo quadro veem o cartão
 * andar sem apertar F5: qualquer mudança nas tabelas do quadro recarrega —
 * agrupada em 250ms, porque arrastar um cartão dispara várias linhas.
 */
export function useBoard(boardId: string | null) {
  const qc = useQueryClient()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!boardId) return
    const recarrega = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['board', boardId] })
        qc.invalidateQueries({ queryKey: ['card'] })
      }, 250)
    }
    const tabelas = ['board_columns', 'board_cards', 'board_card_assignees', 'board_card_labels',
                     'board_labels', 'board_checklist_items', 'board_comments']
    let canal = supabase.channel(`quadro:${boardId}`)
    for (const table of tabelas) {
      canal = canal.on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `board_id=eq.${boardId}` }, recarrega)
    }
    canal.subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(canal)
    }
  }, [boardId, qc])

  return useQuery({
    queryKey: ['board', boardId],
    queryFn:  () => fetchBoardFull(boardId!),
    enabled:  !!boardId,
  })
}

export function useCardDetail(cardId: string | null) {
  return useQuery({
    queryKey: ['card', cardId],
    queryFn:  () => fetchCardDetail(cardId!),
    enabled:  !!cardId,
  })
}

export function useMembros() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['membros', tenantId],
    queryFn:  () => fetchMembros(tenantId!),
    enabled:  !!tenantId,
    staleTime: 5 * 60 * 1000,
  })
}

/** Depois de escrever: recarrega o quadro (e a lista, que tem contadores). */
export function useRecarregaQuadro(boardId: string | null) {
  const qc = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return (cardId?: string) => {
    if (boardId) qc.invalidateQueries({ queryKey: ['board', boardId] })
    if (cardId)  qc.invalidateQueries({ queryKey: ['card', cardId] })
    qc.invalidateQueries({ queryKey: ['boards', tenantId] })
  }
}
