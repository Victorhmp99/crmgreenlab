import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  createPipeline, updatePipeline, deletePipeline,
  createStage, updateStage, deleteStage, reorderStagesService,
} from '@/services/pipelineManagement'
import type { PipelineStage } from '@/types'

export function usePipelineManagement() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)

  function invalidatePipelines() {
    queryClient.invalidateQueries({ queryKey: ['pipelines', tenantId] })
  }

  function invalidateStages(pipelineId?: string) {
    queryClient.invalidateQueries({ queryKey: ['pipeline-stages', tenantId, pipelineId] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-stages', tenantId] })
  }

  // ── Pipelines ─────────────────────────────────────────────────────────────

  const addPipeline = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      createPipeline(tenantId!, name, color),
    onSuccess: invalidatePipelines,
  })

  const renamePipeline = useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) =>
      updatePipeline(id, { name, color }),
    onSuccess: invalidatePipelines,
  })

  const removePipeline = useMutation({
    mutationFn: (id: string) => deletePipeline(id),
    onSuccess:  invalidatePipelines,
  })

  // ── Etapas ─────────────────────────────────────────────────────────────────

  const addStage = useMutation({
    mutationFn: ({
      pipelineId, name, color, position,
    }: { pipelineId: string; name: string; color: string; position: number }) =>
      createStage(tenantId!, pipelineId, name, color, position),
    onSuccess: (_, variables) => invalidateStages(variables.pipelineId),
  })

  const editStage = useMutation({
    mutationFn: ({
      id, data, pipelineId: _pid,
    }: { id: string; data: Partial<Pick<PipelineStage, 'name' | 'color' | 'stage_type' | 'funnel_step_id'>>; pipelineId: string }) =>
      updateStage(id, data),
    onSuccess: (_, variables) => {
      invalidateStages(variables.pipelineId)
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-financial', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['funnel-metrics', tenantId] })
    },
  })

  const removeStage = useMutation({
    mutationFn: ({ id, pipelineId: _pid }: { id: string; pipelineId: string }) =>
      deleteStage(id),
    onSuccess: (_, variables) => {
      invalidateStages(variables.pipelineId)
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards', tenantId] })
    },
  })

  const reorderStages = useMutation({
    mutationFn: ({
      updates, pipelineId: _pid,
    }: { updates: Array<{ id: string; position: number }>; pipelineId: string }) =>
      reorderStagesService(updates),
    onSuccess: (_, variables) => invalidateStages(variables.pipelineId),
  })

  return { addPipeline, renamePipeline, removePipeline, addStage, editStage, removeStage, reorderStages }
}
