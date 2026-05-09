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

// ── Schema do formulário de criação rápida ────────────────────────────────────

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
  onClose:       () => void
}

export function QuickAddLeadModal({ stageId, stageName, stagePosition, onClose }: QuickAddLeadModalProps) {
  const tenantId    = useAuthStore((s) => s.tenant?.id)!
  const queryClient = useQueryClient()

  // Tab: criar novo lead OU buscar lead existente
  const [tab, setTab] = useState<'create' | 'existing'>('create')

  // Estado para busca de lead existente
  const [existingLeads, setExistingLeads]   = useState<Lead[]>([])
  const [searchQuery, setSearchQuery]       = useState('')
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [addingExistingId, setAddingExistingId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'manual' },
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['leads', tenantId] })
  }

  // ── Criar novo lead e adicionar ao pipeline ───────────────────────────────

  async function onSubmit(data: FormData) {
    // 1. Cria o lead
    const lead = await createLead(tenantId, {
      name:   data.name,
      phone:  data.phone || undefined,
      source: data.source,
      status: 'active',
    })

    // 2. Adiciona ao pipeline na etapa correta
    await addLeadToPipeline(tenantId, lead.id, stageId!, stagePosition)

    invalidate()
    reset()
    onClose()
  }

  // ── Carregar leads existentes ao trocar para a aba ────────────────────────

  async function handleTabExisting() {
    setTab('existing')
    if (existingLeads.length > 0) return   // já carregados
    setLoadingExisting(true)
    try {
      const leads = await fetchLeadsNotInPipeline(tenantId)
      setExistingLeads(leads)
    } finally {
      setLoadingExisting(false)
    }
  }

  // ── Adicionar lead existente ──────────────────────────────────────────────

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
        (l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.phone?.includes(searchQuery),
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
      <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1 mb-5">
        <button
          onClick={() => setTab('create')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === 'create'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserPlus size={14} />
          Novo lead
        </button>
        <button
          onClick={handleTabExisting}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === 'existing'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search size={14} />
          Lead existente
        </button>
      </div>

      {/* ── Tab: Criar novo ──────────────────────────────────────────────── */}
      {tab === 'create' && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nome do lead *"
            placeholder="Ex: João Silva"
            autoFocus
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Telefone / WhatsApp"
              placeholder="(11) 99999-9999"
              type="tel"
              {...register('phone')}
            />
            <Select
              label="Origem"
              options={SOURCE_OPTIONS}
              {...register('source')}
            />
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

      {/* ── Tab: Lead existente ──────────────────────────────────────────── */}
      {tab === 'existing' && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto -mx-1 px-1">
            {loadingExisting ? (
              <div className="py-10 text-center text-sm text-slate-400">Carregando leads...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm font-medium text-slate-600">
                  {existingLeads.length === 0
                    ? 'Todos os leads ativos já estão no pipeline'
                    : 'Nenhum lead encontrado para essa busca'}
                </p>
                {existingLeads.length === 0 && (
                  <button
                    onClick={() => setTab('create')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
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
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{lead.name}</p>
                    {lead.phone && (
                      <p className="text-xs text-slate-400 mt-0.5">{lead.phone}</p>
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
