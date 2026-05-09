import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { useActivityMutations } from '../../hooks/useActivityMutations'
import { ACTIVITY_CONFIG, MANUAL_ACTIVITY_TYPES } from '../ActivityTypeIcon'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Lead } from '@/types'

const schema = z.object({
  lead_id:     z.string().min(1, 'Selecione um lead'),
  type:        z.enum(['call', 'whatsapp', 'email', 'meeting', 'note']),
  description: z.string().optional(),
  followup_at: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface ActivityFormProps {
  open:         boolean
  onClose:      () => void
  presetLeadId?: string    // se aberto a partir do drawer de um lead específico
  presetLeadName?: string
}

const TYPE_OPTIONS = MANUAL_ACTIVITY_TYPES.map((t) => ({
  value: t,
  label: ACTIVITY_CONFIG[t].label,
}))

export function ActivityForm({ open, onClose, presetLeadId, presetLeadName }: ActivityFormProps) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { create } = useActivityMutations()

  const [leads, setLeads]     = useState<Lead[]>([])
  const [search, setSearch]   = useState('')
  const [filtered, setFiltered] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'call' },
  })

  const selectedLeadId = watch('lead_id')
  const selectedLead   = leads.find((l) => l.id === selectedLeadId)

  // Busca leads ao abrir (só se não há lead pré-definido)
  useEffect(() => {
    if (!open || !tenantId || presetLeadId) return
    setLoadingLeads(true)
    ;(async () => {
      try {
        const { data } = await supabase
          .from('leads')
          .select('id, name, phone, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('name')
        setLeads((data ?? []) as Lead[])
        setFiltered((data ?? []) as Lead[])
      } finally {
        setLoadingLeads(false)
      }
    })()
  }, [open, tenantId, presetLeadId])

  // Filtra localmente
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      q ? leads.filter((l) => l.name.toLowerCase().includes(q) || l.phone?.includes(q)) : leads,
    )
  }, [search, leads])

  // Pré-define lead quando vem do drawer
  useEffect(() => {
    if (open && presetLeadId) {
      setValue('lead_id', presetLeadId)
    }
  }, [open, presetLeadId, setValue])

  useEffect(() => {
    if (!open) {
      reset({ type: 'call' })
      setSearch('')
    }
  }, [open, reset])

  async function onSubmit(data: FormData) {
    await create.mutateAsync({
      lead_id:     data.lead_id,
      type:        data.type,
      description: data.description || undefined,
      followup_at: data.followup_at || undefined,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar Disparo"
      description="Registre um contato realizado com este lead"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button form="activity-form" type="submit" loading={isSubmitting}>
            Salvar disparo
          </Button>
        </>
      }
    >
      <form id="activity-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Seleção de lead (oculta se há lead pré-definido) */}
        {presetLeadId ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
              {(presetLeadName ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{presetLeadName}</p>
              <p className="text-xs text-slate-400">Lead selecionado</p>
            </div>
            <input type="hidden" {...register('lead_id')} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Lead *</label>

            {/* Busca de lead */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar lead por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300 transition-colors"
              />
            </div>

            {/* Lista de leads */}
            <div className="rounded-xl border border-slate-200 max-h-44 overflow-y-auto">
              {loadingLeads ? (
                <div className="py-6 text-center text-sm text-slate-400">Carregando leads...</div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Nenhum lead encontrado</div>
              ) : (
                filtered.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => { setValue('lead_id', lead.id, { shouldValidate: true }); setSearch('') }}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                      selectedLeadId === lead.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-semibold shrink-0">
                      {lead.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{lead.name}</p>
                      {lead.phone && <p className="text-xs text-slate-400">{lead.phone}</p>}
                    </div>
                    {selectedLeadId === lead.id && (
                      <span className="ml-auto text-blue-600 text-xs font-medium shrink-0">✓</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Campo oculto para validação */}
            <input type="hidden" {...register('lead_id')} />
            {errors.lead_id && <p className="text-xs text-red-500">{errors.lead_id.message}</p>}

            {/* Lead selecionado */}
            {selectedLead && !search && (
              <p className="text-xs text-blue-600 font-medium">
                ✓ {selectedLead.name} selecionado
              </p>
            )}
          </div>
        )}

        {/* Tipo */}
        <Select
          label="Tipo de contato *"
          options={TYPE_OPTIONS}
          error={errors.type?.message}
          {...register('type')}
        />

        {/* Descrição */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">O que foi abordado?</label>
          <textarea
            rows={3}
            placeholder="Descreva o que foi conversado ou acordado..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300 resize-none transition-colors"
            {...register('description')}
          />
        </div>

        {/* Próximo follow-up */}
        <Input
          label="Próximo follow-up (opcional)"
          type="date"
          hint="Define um lembrete visível na timeline"
          {...register('followup_at')}
        />

        {create.error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            Erro ao salvar. Tente novamente.
          </p>
        )}
      </form>
    </Modal>
  )
}
