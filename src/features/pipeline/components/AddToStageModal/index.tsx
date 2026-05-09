import { useState, useEffect } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { LeadSourceBadge } from '@/features/leads/components/LeadSourceBadge'
import { usePipelineMutations } from '../../hooks/usePipelineMutations'
import { fetchLeadsNotInPipeline } from '@/services/pipeline'
import { useAuthStore } from '@/store/authStore'
import { formatPhone } from '@/lib/utils'
import type { Lead } from '@/types'

interface AddToStageModalProps {
  stageId:       string | null
  stageName?:    string
  stagePosition: number
  onClose:       () => void
}

export function AddToStageModal({ stageId, stageName, stagePosition, onClose }: AddToStageModalProps) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { add }  = usePipelineMutations()

  const [leads,     setLeads]     = useState<Lead[]>([])
  const [filtered,  setFiltered]  = useState<Lead[]>([])
  const [search,    setSearch]    = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [addingId,  setAddingId]  = useState<string | null>(null)

  useEffect(() => {
    if (!stageId || !tenantId) return
    setIsLoading(true)
    setSearch('')
    fetchLeadsNotInPipeline(tenantId)
      .then((data) => { setLeads(data); setFiltered(data) })
      .finally(() => setIsLoading(false))
  }, [stageId, tenantId])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      q ? leads.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q),
      ) : leads,
    )
  }, [search, leads])

  async function handleAdd(lead: Lead) {
    if (!stageId) return
    setAddingId(lead.id)
    try {
      await add.mutateAsync({ leadId: lead.id, stageId, position: stagePosition })
      setLeads((prev) => prev.filter((l) => l.id !== lead.id))
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Modal
      open={!!stageId}
      onClose={onClose}
      title={`Adicionar lead${stageName ? ` em "${stageName}"` : ''}`}
      description="Selecione um lead ativo para adicionar ao pipeline"
      size="md"
    >
      {/* Busca */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: '#444' }} />
        <input
          autoFocus
          type="text"
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg pl-9 pr-3 text-sm transition-all focus:outline-none"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
          onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
          onBlur={(e) => (e.currentTarget.style.border = '1px solid #2a2a2a')}
        />
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto -mx-1 px-1">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <UserPlus size={28} style={{ color: '#333' }} />
            <p className="text-sm" style={{ color: '#555' }}>
              {leads.length === 0
                ? 'Todos os leads ativos já estão no pipeline'
                : 'Nenhum lead encontrado para essa busca'}
            </p>
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
                <div className="flex items-center gap-2 mt-0.5">
                  {lead.phone && (
                    <span className="text-xs" style={{ color: '#555' }}>{formatPhone(lead.phone)}</span>
                  )}
                  <LeadSourceBadge source={lead.source} />
                </div>
              </div>

              <button
                onClick={() => handleAdd(lead)}
                disabled={addingId === lead.id}
                className="ml-3 shrink-0 h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--tenant-primary)', border: '1px solid rgba(0,230,118,0.3)' }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--tenant-primary)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#000'
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--tenant-primary)'
                }}
              >
                {addingId === lead.id ? (
                  <Spinner size="sm" />
                ) : (
                  <><UserPlus size={13} /> Adicionar</>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
