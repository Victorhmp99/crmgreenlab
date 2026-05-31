import { useState } from 'react'
import { UserPlus, Search, Check, CheckCheck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LeadFormFields } from '@/features/leads/components/LeadForm/LeadFormFields'
import { useAuthStore } from '@/store/authStore'
import { addLeadToPipeline, fetchLeadsNotInPipeline } from '@/services/pipeline'
import { useQueryClient } from '@tanstack/react-query'
import type { Lead } from '@/types'

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

  const [tab, setTab]                         = useState<'create' | 'existing'>('create')
  const [existingLeads, setExistingLeads]     = useState<Lead[]>([])
  const [searchQuery, setSearchQuery]         = useState('')
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [addingExisting, setAddingExisting]   = useState(false)
  const [submitting, setSubmitting]           = useState(false)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['leads', tenantId] })
  }

  function handleClose() {
    setTab('create')
    setSelectedIds(new Set())
    setSearchQuery('')
    setExistingLeads([])
    onClose()
  }

  // Adiciona o lead recém-criado à etapa (callback do LeadFormFields)
  async function handleAfterCreate(lead: Lead) {
    await addLeadToPipeline(tenantId, lead.id, stageId!, stagePosition)
    invalidate()
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

  const filtered = searchQuery
    ? existingLeads.filter(
        (l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone?.includes(searchQuery),
      )
    : existingLeads

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filtered.forEach((l) => next.delete(l.id))
      } else {
        filtered.forEach((l) => next.add(l.id))
      }
      return next
    })
  }

  async function handleAddSelected() {
    const ids = existingLeads.filter((l) => selectedIds.has(l.id)).map((l) => l.id)
    if (ids.length === 0) return
    setAddingExisting(true)
    try {
      // Adiciona em sequência, incrementando a posição
      let pos = stagePosition
      for (const id of ids) {
        await addLeadToPipeline(tenantId, id, stageId!, pos)
        pos += 1
      }
      invalidate()
      handleClose()
    } finally {
      setAddingExisting(false)
    }
  }

  const selectedCount = selectedIds.size

  return (
    <Modal
      open={!!stageId}
      onClose={handleClose}
      title={`Adicionar lead${stageName ? ` em "${stageName}"` : ''}`}
      size="md"
      footer={
        tab === 'create' ? (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={submitting}>Cancelar</Button>
            <Button form="pipeline-lead-form" type="submit" loading={submitting}>
              <UserPlus size={15} /> Criar e adicionar
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={addingExisting}>Cancelar</Button>
            <Button onClick={handleAddSelected} loading={addingExisting} disabled={selectedCount === 0}>
              Adicionar {selectedCount > 0 ? `${selectedCount} ` : ''}selecionado{selectedCount !== 1 ? 's' : ''}
            </Button>
          </>
        )
      }
    >
      {/* Tabs */}
      <div className="flex rounded-xl p-1 gap-1 mb-5"
        style={{ background: '#111', border: '1px solid #1e1e1e' }}>
        {([
          { id: 'create',   label: 'Novo lead',      icon: UserPlus },
          { id: 'existing', label: 'Lead existente', icon: Search   },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
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

      {/* Tab: Criar novo — formulário completo (mesmo da página de Leads) */}
      {tab === 'create' && (
        <LeadFormFields
          formId="pipeline-lead-form"
          open={tab === 'create' && !!stageId}
          afterCreate={handleAfterCreate}
          onDone={handleClose}
          onSubmittingChange={setSubmitting}
        />
      )}

      {/* Tab: Lead existente — multi-seleção */}
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

          {/* Selecionar todos */}
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-2 text-xs font-medium self-start px-1 transition-colors"
              style={{ color: allFilteredSelected ? 'var(--tenant-primary)' : '#888' }}
            >
              <CheckCheck size={14} />
              {allFilteredSelected ? 'Desmarcar todos' : `Selecionar todos (${filtered.length})`}
            </button>
          )}

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
                    type="button"
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
              filtered.map((lead) => {
                const checked = selectedIds.has(lead.id)
                return (
                  <button
                    type="button"
                    key={lead.id}
                    onClick={() => toggleOne(lead.id)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                    style={{ background: checked ? 'rgba(0,230,118,0.08)' : 'transparent' }}
                    onMouseEnter={(e) => { if (!checked) (e.currentTarget.style.background = '#191919') }}
                    onMouseLeave={(e) => { if (!checked) (e.currentTarget.style.background = 'transparent') }}
                  >
                    {/* Checkbox */}
                    <span
                      className="h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                      style={{
                        background: checked ? 'var(--tenant-primary)' : 'transparent',
                        border: checked ? '1px solid var(--tenant-primary)' : '1px solid #3a3a3a',
                      }}
                    >
                      {checked && <Check size={13} style={{ color: '#000' }} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#e8e8e8' }}>{lead.name}</p>
                      {lead.phone && (
                        <p className="text-xs mt-0.5" style={{ color: '#555' }}>{lead.phone}</p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
