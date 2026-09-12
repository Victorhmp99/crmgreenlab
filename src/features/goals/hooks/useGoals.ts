import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchGoalsWithProgress,
  fetchUserGoals,
  fetchLeaderboard,
  fetchDashboardGoals,
  fetchDetalheMeta,
  fetchMetasEmpresa,
} from '@/services/goals'

export function useAllGoals(onlyActive = false) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['goals', tenantId, { onlyActive }],
    queryFn:   () => fetchGoalsWithProgress(tenantId!, onlyActive),
    enabled:   !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useMyGoals() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const userId   = useAuthStore((s) => s.user?.id)

  return useQuery({
    queryKey:  ['goals-mine', tenantId, userId],
    queryFn:   () => fetchUserGoals(tenantId!, userId!),
    enabled:   !!tenantId && !!userId,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useDashboardGoals() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const userId   = useAuthStore((s) => s.user?.id)

  return useQuery({
    queryKey:  ['goals-dashboard', tenantId, userId],
    queryFn:   () => fetchDashboardGoals(tenantId!, userId!),
    enabled:   !!tenantId && !!userId,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useLeaderboard(startDate: string, endDate: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['leaderboard', tenantId, startDate, endDate],
    queryFn:   () => fetchLeaderboard(tenantId!, startDate, endDate),
    enabled:   !!tenantId && !!startDate && !!endDate,
    staleTime: 1000 * 60,  // 1 min
    refetchOnMount: true,
  })
}

// ── Auditoria: do que é feito o número ───────────────────────────────────────
export function useDetalheMeta(goalId: string | null) {
  return useQuery({
    queryKey: ['meta-detalhe', goalId],
    queryFn:  () => fetchDetalheMeta(goalId!),
    enabled:  !!goalId,
    staleTime: 0,
  })
}

// ── Meta da empresa ──────────────────────────────────────────────────────────
export function useMetasEmpresa(onlyActive = false) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['metas-empresa', tenantId, { onlyActive }],
    queryFn:  () => fetchMetasEmpresa(tenantId!, onlyActive),
    enabled:  !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
  })
}
