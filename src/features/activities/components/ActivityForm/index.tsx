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
  open:             boolean
  onClose:          () => void
  presetLeadId?:    string
  presetLeadName?:  string
}

const TYPE_OPTIONS = MANUAL_ACTIVITY_TYPES.map((t) => ({
  value: t,
  label: ACTIVITY_CONFIG[t].label,
}))

export function ActivityForm({ open, onClose, presetLeadId, presetLeadName }: ActivityFormProps) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { create } = useActivityMutations()

  const [leads, setLeads]         = useState<Lead[]>([])
  const [search, setSearch]       = useState('')
  const [filtered, setFiltered]   = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'call' },
  })

  const selectedLeadId = watch('lead_id')
  const selectedLead   = leads.find((l) => l.id === selectedLeadId)

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

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      q ? leads.filter((l) => l.name.toLowerCase().includes(q) || l.phone?.includes(q)) : leads,
    )
  }, [search, leads])

  useEffect(() => {
    if (open && presetLeadId) setValue('lead_id', presetLeadId)
  }, [open, presetLeadId, setValue])

  useEffect(() => {
    if (!open) { reset({ type: 'call' }); setSearch('') }
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
        {/* Lead pré-definido ou seleção */}
        {presetLeadId ? (
          <div className="rounded-xl px-4 py-3 flex items-center gap-2"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-black font-semibold text-sm shrink-0"
              style={{ background: 'var(--tenant-primary)' }}>
              {(presetLeadName ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: '#e8e8e8' }}>{presetLeadName}</p>
              <p className="text-xs" style={{ color: '#555' }}>Lead selecionado</p>
            </div>
            <input type="hidden" {...register('lead_id')} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Lead *</label>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#444' }} />
              <input
                type="text"
                placeholder="Buscar lead por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg pl-8 pr-3 text-sm transition-all focus:outline-none"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
                onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
                onBlur={(e) => (e.currentTarget.style.border = '1px solid #2a2a2a')}
              />
            </div>

            <div className="rounded-xl max-h-44 overflow-y-auto"
              style={{ border: '1px solid #2a2a2a' }}>
              {loadingLeads ? (
                <div className="py-6 text-center text-sm" style={{ color: '#444' }}>Carregando leads...</div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm" style={{ color: '#444' }}>Nenhum lead encontrado</div>
              ) : (
                filtered.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => { setValue('lead_id', lead.id, { shouldValidate: true }); setSearch('') }}
                    className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors"
                    style={{
                      borderBottom: '1px solid #191919',
                      background: selectedLeadId === lead.id ? 'rgba(0,230,118,0.06)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedLeadId !== lead.id) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = selectedLeadId === lead.id ? 'rgba(0,230,118,0.06)' : 'transparent'
                    }}
                  >
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ background: '#1e1e1e', color: '#666' }}>
                      {lead.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: '#e8e8e8' }}>{lead.name}</p>
                      {lead.phone && <p className="text-xs" style={{ color: '#555' }}>{lead.phone}</p>}
                    </div>
                    {selectedLeadId === lead.id && (
                      <span className="ml-auto text-xs font-medium shrink-0" style={{ color: 'var(--tenant-primary)' }}>✓</span>
                    )}
                  </button>
                ))
              )}
            </div>

            <input type="hidden" {...register('lead_id')} />
            {errors.lead_id && <p className="text-xs" style={{ color: '#ff4444' }}>{errors.lead_id.message}</p>}

            {selectedLead && !search && (
              <p className="text-xs font-medium" style={{ color: 'var(--tenant-primary)' }}>
                ✓ {selectedLead.name} selecionado
              </p>
            )}
          </div>
        )}

        <Select label="Tipo de contato *" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            O que foi abordado?
          </label>
          <textarea
            rows={3}
            placeholder="Descreva o que foi conversado ou acordado..."
            className="w-full rounded-lg px-3 py-2 text-sm resize-none transition-all focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
            onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
            {...register('description')}
          />
        </div>

        <Input
          label="Próximo follow-up (opcional)"
          type="date"
          hint="Define um lembrete visível na timeline"
          {...register('followup_at')}
        />

        {create.error && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
            Erro ao salvar. Tente novamente.
          </p>
        )}
      </form>
    </Modal>
  )
}
