import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchLeadContract,
  createClientContract,
  updateContractStatus,
  updateContract,
  generateMoreReminders,
  recalculateLeadValue,
  type CreateContractData,
  type UpdateContractData,
  type ContractStatus,
} from '@/services/clientContracts'

export function useLeadContract(leadId: string | null) {
  return useQuery({
    queryKey:  ['lead-contract', leadId],
    queryFn:   () => fetchLeadContract(leadId!),
    enabled:   !!leadId,
    staleTime: 1000 * 30,
  })
}

export function useClientContractMutations(leadId?: string | null) {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const userId   = useAuthStore((s) => s.user?.id)

  async function invalidate() {
    if (leadId) {
      await recalculateLeadValue(leadId)
      queryClient.invalidateQueries({ queryKey: ['lead-contract', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-purchases', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId] })
    }
    queryClient.invalidateQueries({ queryKey: ['tasks',               tenantId] })
    queryClient.invalidateQueries({ queryKey: ['active-mrr',          tenantId] })
    queryClient.invalidateQueries({ queryKey: ['cash-flow-forecast',  tenantId] })
    queryClient.invalidateQueries({ queryKey: ['leads',                tenantId] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards',       tenantId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics',    tenantId] })
    queryClient.invalidateQueries({ queryKey: ['financial-summary',    tenantId] })
    queryClient.invalidateQueries({ queryKey: ['financial-trend',      tenantId] })
  }

  const create = useMutation({
    mutationFn: (data: CreateContractData) => createClientContract(tenantId!, userId!, data),
    onSuccess: invalidate,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContractStatus }) =>
      updateContractStatus(id, status),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContractData }) =>
      updateContract(id, data),
    onSuccess: invalidate,
  })

  const generateMore = useMutation({
    mutationFn: (amount: number) => generateMoreReminders(tenantId!, leadId!, amount, userId!),
    onSuccess: invalidate,
  })

  return { create, updateStatus, update, generateMore }
}
