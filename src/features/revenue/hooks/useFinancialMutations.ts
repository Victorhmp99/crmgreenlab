import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type CreateTransactionData,
} from '@/services/financial'

export function useFinancialMutations() {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const user   = useAuthStore((s) => s.user)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['transactions',      tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['financial-summary', tenant?.id] })
    queryClient.invalidateQueries({ queryKey: ['financial-trend',   tenant?.id] })
  }

  const create = useMutation({
    mutationFn: (data: CreateTransactionData) =>
      createTransaction(tenant!.id, user!.id, data),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionData> }) =>
      updateTransaction(id, data),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: deleteTransaction,
    onSuccess:  invalidate,
  })

  return { create, update, remove }
}
