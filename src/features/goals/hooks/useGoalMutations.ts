import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { createGoal, updateGoal, deleteGoal, type CreateGoalData } from '@/services/goals'

export function useGoalMutations() {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const user   = useAuthStore((s) => s.user)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['goals',       tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['goals-mine',  tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['leaderboard', tenant?.id] })
  }

  const create = useMutation({
    mutationFn: (data: CreateGoalData) => createGoal(tenant!.id, user!.id, data),
    onSuccess:  invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGoalData> }) =>
      updateGoal(id, data),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess:  invalidate,
  })

  return { create, update, remove }
}
