import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuthStore } from '@/store/authStore'
import { createLead } from '@/services/leads'
import { addLeadToPipeline, fetchLeadsNotInPipeline } from '@/services/pipeline'
import { useQueryClient } from '@tanstack/react-query'
import type { Lead } from '@/types'

const schema = z.object({
  name:   z.string().min(1, 'Nome obrigatório'),
  phone:  z.string().optional(),
  source: z.enum(['manual', 'import', 'meta_ads', 'google', 'referral', 'other']),
})
type FormData = z.infer<typeof schema>

const SOURCE_OPTIONS = [
  { value: 'manual',   label: 'Manual'    },
  { value: 'meta_ads', label: 'Meta Ads'  },
  { value: 'google',   label: 'Google'    },
  { value: 'referral', label: 'Indicação' },
  { value: 'other',    label: 'Outro'     },
]

interface QuickAddLeadModalProps {
  stageId:       string | null
  stageName?:    string
  stagePosition: number
  pipelineName?: string
  onClose:       () => void
}

export function QuickAddLeadModal({ stageId, stageName, stagePosition, onClose }: QuickAddLeadModalProps) {
  const tenantId    = useAuthStore((s) => s.tenant?.id)!
  const queryClient = useQueryClient()

  const [tab, setTab]                       = useState<'create' | 'existing'>('create')
  const [existingLeads, setExistingLeads]   = useState<Lead[]>([])
  const [searchQuery, setSearchQuery]       = useState('')
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [addingExistingId, setAddingExistingId] = useState<string | null>(null)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'manual' },
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['leads', tenantId] })
  }

  async function onSubmit(data: FormData) {
    const lead = await createLead(tenantId, {
      name: data.name, phone: data.phone || undefined, source: data.source, status: 'active',
    })
    await addLeadToPipeline(tenantId, lead.id, stageId!, stagePosition)
    invalidate()
    reset()
    onClose()
  }

  async function handleTabExisting() {
    setTab('existing')
    if (existingLeads.length > 0) return
    setLoadingExisting(true)
    try {
      const leads = await fetchLeadsNotInPipeline(tenantId)
      setExistingLeads(leads)
    } finally {
      setLoadingExisting(false)
    }
  }

  async function handleAddExisting(lead: Lead) {
    setAddingExistingId(lead.id)
    try {
      await addLeadToPipeline(tenantId, lead.id, stageId!, stagePosition)
      setExistingLeads((prev) => prev.filter((l) => l.id !== lead.id))
      invalidate()
      if (existingLeads.length <= 1) onClose()
    } finally {
      setAddingExistingId(null)
    }
  }

  const filtered = searchQuery
    ? existingLeads.filter(
        (l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone?.includes(searchQuery),
      )
    : existingLeads

  return (
    <Modal
      open={!!stageId}
      onClose={onClose}
      title={`Adicionar lead${stageName ? ` em "${stageName}"` : ''}`}
      size="md"
    >
      {/* Tabs */}
      <div className="flex rounded-xl p-1 gap-1 mb-5"
        style={{ background: '#111', border: '1px solid #1e1e1e' }}>
        {([
          { id: 'create',   label: 'Novo lead',      icon: UserPlus },
          { id: 'existing', label: 'Lead existente',  icon: Search   },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => id === 'existing' ? handleTabExisting() : setTab('create')}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all"
            style={
              tab === id
                ? { background: '#1e1e1e', color: '#e8e8e8', boxShadow: '0 0 0 1px #2a2a2a' }
                : { color: '#555' }
            }
            onMouseEnter={(e) => { if (tab !== id) (e.currentTarget as HTMLButtonElement).style.color = '#aaa' }}
            onMouseLeave={(e) => { if (tab !== id) (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Criar novo */}
      {tab === 'create' && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label="Nome do lead *" placeholder="Ex: João Silva" autoFocus
            error={errors.name?.message} {...register('name')} />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Telefone / WhatsApp" placeholder="(11) 99999-9999" type="tel" {...register('phone')} />
            <Select label="Origem" options={SOURCE_OPTIONS} {...register('source')} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              <UserPlus size={15} />
              Criar e adicionar
            </Button>
          </div>
        </form>
      )}

      {/* Tab: Lead existente */}
      {tab === 'existing' && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: '#444' }} />
            <input
              autoFocus
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg pl-8 pr-3 text-sm transition-all focus:outline-none"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
              onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
              onBlur={(e) => (e.currentTarget.style.border = '1px solid #2a2a2a')}
            />
          </div>

          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto -mx-1 px-1">
            {loadingExisting ? (
              <div className="py-10 text-center text-sm" style={{ color: '#444' }}>Carregando leads...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm font-medium" style={{ color: '#666' }}>
                  {existingLeads.length === 0
                    ? 'Todos os leads ativos já estão no pipeline'
                    : 'Nenhum lead encontrado para essa busca'}
                </p>
                {existingLeads.length === 0 && (
                  <button
                    onClick={() => setTab('create')}
                    className="text-sm font-medium flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--tenant-primary)' }}
                  >
                    <UserPlus size={14} />
                    Criar um novo lead
                  </button>
                )}
              </div>
            ) : (
              filtered.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#e8e8e8' }}>{lead.name}</p>
                    {lead.phone && (
                      <p className="text-xs mt-0.5" style={{ color: '#555' }}>{lead.phone}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    loading={addingExistingId === lead.id}
                    onClick={() => handleAddExisting(lead)}
                    className="ml-3 shrink-0"
                  >
                    Adicionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
