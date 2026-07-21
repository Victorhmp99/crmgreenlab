import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchTasks, fetchLeadTasks, createTask, updateTask, deleteTask, deleteTasks,
  type TaskFilters, type CreateTaskData, type UpdateTaskData,
} from '@/services/leadTasks'

export function useTasks(filters: TaskFilters = {}) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['tasks', tenantId, JSON.stringify(filters)],
    queryFn:   () => fetchTasks(tenantId!, filters),
    enabled:   !!tenantId,
    staleTime: 1000 * 30,
  })
}

export function useLeadTasks(leadId: string | null) {
  return useQuery({
    queryKey:  ['lead-tasks', leadId],
    queryFn:   () => fetchLeadTasks(leadId!),
    enabled:   !!leadId,
    staleTime: 1000 * 30,
  })
}

export function useTaskMutations(leadId?: string | null) {
  const queryClient = useQueryClient()
  const tenantId    = useAuthStore((s) => s.tenant?.id)
  const userId      = useAuthStore((s) => s.user?.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['tasks',      tenantId] })
    if (leadId) queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId] })
  }

  const create = useMutation({
    mutationFn: (data: CreateTaskData) => createTask(tenantId!, userId!, data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskData }) => updateTask(id, data),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: invalidate,
  })

  const removeMany = useMutation({
    mutationFn: (ids: string[]) => deleteTasks(ids),
    onSuccess: invalidate,
  })

  return { create, update, remove, removeMany }
}
