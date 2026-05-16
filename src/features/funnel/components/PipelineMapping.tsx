import { useEffect, useState } from 'react'
import { Kanban, Save, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useFunnelSteps } from '../hooks/useFunnelSteps'
import { useQueryClient } from '@tanstack/react-query'

interface StageWithFunnelStep {
  id:               string
  name:             string
  color:            string
  position:         number
  funnel_step_id:   string | null
  pipeline_id:      string
  pipeline_name:    string
}

export function PipelineMapping() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const queryClient = useQueryClient()
  const { data: funnelSteps = [] } = useFunnelSteps()

  const [stages, setStages]   = useState<StageWithFunnelStep[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [drafts, setDrafts]   = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    supabase
      .from('pipeline_stages')
      .select('id, name, color, position, funnel_step_id, pipeline_id, pipelines(name)')
      .eq('tenant_id', tenantId)
      .order('pipeline_id')
      .order('position')
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as Array<{
          id: string; name: string; color: string; position: number;
          funnel_step_id: string | null; pipeline_id: string;
          pipelines: { name: string } | { name: string }[] | null;
        }>).map((s) => {
          const pl = Array.isArray(s.pipelines) ? s.pipelines[0] : s.pipelines
          return {
            id: s.id,
            name: s.name,
            color: s.color,
            position: s.position,
            funnel_step_id: s.funnel_step_id,
            pipeline_id: s.pipeline_id,
            pipeline_name: pl?.name ?? 'Pipeline',
          }
        })
        setStages(list)
        setLoading(false)
      })
  }, [tenantId])

  function handleChange(stageId: string, funnelStepId: string) {
    setDrafts((prev) => ({ ...prev, [stageId]: funnelStepId || null }))
  }

  async function handleSaveAll() {
    setSaving(true)
    const updates = Object.entries(drafts).map(([stageId, fsId]) =>
      supabase.from('pipeline_stages').update({ funnel_step_id: fsId }).eq('id', stageId),
    )
    await Promise.all(updates)
    // Recarrega
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name, color, position, funnel_step_id, pipeline_id, pipelines(name)')
      .eq('tenant_id', tenantId!)
      .order('pipeline_id')
      .order('position')
    const list2 = ((data ?? []) as unknown as Array<{
      id: string; name: string; color: string; position: number;
      funnel_step_id: string | null; pipeline_id: string;
      pipelines: { name: string } | { name: string }[] | null;
    }>).map((s) => {
      const pl = Array.isArray(s.pipelines) ? s.pipelines[0] : s.pipelines
      return {
        id: s.id, name: s.name, color: s.color, position: s.position,
        funnel_step_id: s.funnel_step_id, pipeline_id: s.pipeline_id,
        pipeline_name: pl?.name ?? 'Pipeline',
      }
    })
    setStages(list2)
    setDrafts({})
    queryClient.invalidateQueries({ queryKey: ['funnel-metrics', tenantId] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasChanges = Object.keys(drafts).length > 0

  // Agrupa por pipeline
  const grouped = stages.reduce<Record<string, StageWithFunnelStep[]>>((acc, s) => {
    if (!acc[s.pipeline_id]) acc[s.pipeline_id] = []
    acc[s.pipeline_id].push(s)
    return acc
  }, {})

  const funnelStepOptions = [
    { value: '', label: '— Não mapeado —' },
    ...funnelSteps.map((fs) => ({ value: fs.id, label: fs.name })),
  ]

  return (
    <section className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kanban size={15} style={{ color: 'var(--tenant-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Mapeamento Pipeline → Funil
          </h3>
          {stages.length > 0 && (
            <span className="text-[10px] rounded-full px-1.5 py-0.5"
              style={{ background: 'var(--bg-surface3)', color: 'var(--text-dim)' }}>
              {stages.filter((s) => s.funnel_step_id).length}/{stages.length} mapeadas
            </span>
          )}
        </div>
        {hasChanges && (
          <Button size="sm" onClick={handleSaveAll} loading={saving}>
            <Save size={12} /> Salvar tudo
          </Button>
        )}
        {saved && (
          <span className="text-xs flex items-center gap-1" style={{ color: '#00e676' }}>
            <CheckCircle size={13} /> Salvo
          </span>
        )}
      </div>

      <div className="rounded-lg px-3 py-2 text-xs"
        style={{ background: 'rgba(64,160,255,0.06)', border: '1px solid rgba(64,160,255,0.2)', color: 'var(--text-muted)' }}>
        <strong style={{ color: '#40a0ff' }}>Como funciona:</strong> Para cada etapa do pipeline,
        escolha a qual passo do funil ela representa. Quando um lead estiver naquela etapa,
        contará automaticamente no funil. Etapas sem mapeamento são ignoradas no funil
        (mas continuam no pipeline normalmente).
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : stages.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>
          Nenhuma etapa do pipeline encontrada. Crie etapas no Kanban primeiro.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([pid, stagesInPipeline]) => (
            <div key={pid} className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest font-semibold"
                style={{ color: 'var(--text-dim)' }}>
                Pipeline: {stagesInPipeline[0]?.pipeline_name}
              </p>
              {stagesInPipeline.map((stage) => {
                const currentValue = stage.id in drafts
                  ? (drafts[stage.id] ?? '')
                  : (stage.funnel_step_id ?? '')

                return (
                  <div key={stage.id} className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)' }}>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                    <span className="text-sm font-medium flex-1 min-w-0 truncate"
                      style={{ color: 'var(--text)' }}>
                      {stage.name}
                    </span>
                    <div className="shrink-0 w-48">
                      <Select
                        value={currentValue}
                        onChange={(e) => handleChange(stage.id, e.target.value)}
                        options={funnelStepOptions}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
