import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchGoalsWithProgress,
  fetchUserGoals,
  fetchLeaderboard,
} from '@/services/goals'

export function useAllGoals(onlyActive = false) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['goals', tenantId, { onlyActive }],
    queryFn:   () => fetchGoalsWithProgress(tenantId!, onlyActive),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}

export function useMyGoals() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const userId   = useAuthStore((s) => s.user?.id)

  return useQuery({
    queryKey:  ['goals-mine', tenantId, userId],
    queryFn:   () => fetchUserGoals(tenantId!, userId!),
    enabled:   !!tenantId && !!userId,
    staleTime: 1000 * 60,
  })
}

export function useLeaderboard(startDate: string, endDate: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['leaderboard', tenantId, startDate, endDate],
    queryFn:   () => fetchLeaderboard(tenantId!, startDate, endDate),
    enabled:   !!tenantId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5,
  })
}
