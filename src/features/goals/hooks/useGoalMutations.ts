import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { createGoal, updateGoal, deleteGoal, type CreateGoalData,
  salvarMetaEmpresa, excluirMetaEmpresa, type SalvarMetaEmpresa,
} from '@/services/goals'

export function useGoalMutations() {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const user   = useAuthStore((s) => s.user)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['goals',         tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['goals-mine',    tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['leaderboard',   tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['metas-empresa', tenant?.id] })
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

  // Meta da empresa: uma linha por período, gestor edita.
  const salvarEmpresa = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: SalvarMetaEmpresa }) =>
      salvarMetaEmpresa(tenant!.id, user!.id, data, id),
    onSuccess: invalidate,
  })
  const removerEmpresa = useMutation({
    mutationFn: excluirMetaEmpresa,
    onSuccess:  invalidate,
  })

  return { create, update, remove, salvarEmpresa, removerEmpresa }
}
