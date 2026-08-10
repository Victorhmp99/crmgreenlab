import { useState } from 'react'
import { UserPlus, Upload, Download, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { LeadFiltersBar } from '../components/LeadFilters'
import { LeadTable } from '../components/LeadTable'
import { LeadForm } from '../components/LeadForm'
import { ImportModal } from '../components/ImportModal'
import { ExportModal } from '../components/ExportModal'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'
import { AddToPipelineModal } from '../components/AddToPipelineModal'
import { LeadDrawer } from '@/features/activities/components/LeadDrawer'
import { useLeads } from '../hooks/useLeads'
import { useLeadMutations } from '../hooks/useLeadMutations'
import { useAuthStore } from '@/store/authStore'
import type { Lead } from '@/types'
import type { LeadFilters } from '@/services/leads'

export function LeadsPage() {
  const [filters, setFilters]       = useState<LeadFilters>({ page: 1, pageSize: 20 })
  const [editingLead, setEditingLead]   = useState<Lead | null | undefined>(undefined)
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null)
  const [showImport, setShowImport]     = useState(false)
  const [showExport, setShowExport]     = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [pipelineLead, setPipelineLead] = useState<Lead | null>(null)

  // Modo seleção em massa
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk]     = useState(false)

  const role         = useAuthStore((s) => s.membership?.role)
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const canBulkDelete = role === 'admin' || role === 'manager' || isSuperAdmin

  const { data, isLoading } = useLeads(filters)
  const { removeMany } = useLeadMutations()

  function handleEdit(lead: Lead) {
    setSelectedLead(null)
    setEditingLead(lead)
  }

  function handleCloseForm() {
    setEditingLead(undefined)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAllPage(allIds: string[]) {
    setSelectedIds((prev) => {
      const allOnPageSelected = allIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allOnPageSelected) allIds.forEach((id) => next.delete(id))
      else                   allIds.forEach((id) => next.add(id))
      return next
    })
  }

  function exitSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    await removeMany.mutateAsync(ids)
    exitSelection()
    setConfirmBulk(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Leads</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            {data
              ? `${data.count} lead${data.count !== 1 ? 's' : ''} cadastrado${data.count !== 1 ? 's' : ''}`
              : 'Carregando...'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canBulkDelete && !selectionMode && (
            <Button variant="secondary" onClick={() => setSelectionMode(true)}>
              <CheckSquare size={15} />
              Selecionar
            </Button>
          )}
          {!selectionMode && (
            <>
              <Button variant="secondary" onClick={() => setShowExport(true)}>
                <Download size={15} />
                Exportar
              </Button>
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <Upload size={15} />
                Importar
              </Button>
              <Button onClick={() => setEditingLead(null)}>
                <UserPlus size={15} />
                Novo Lead
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Barra de ações em massa */}
      {selectionMode && (
        <BulkActionBar
          count={selectedIds.size}
          label="lead"
          onCancel={exitSelection}
          onDelete={() => setConfirmBulk(true)}
          deleting={removeMany.isPending}
        />
      )}

      {/* Filtros */}
      <LeadFiltersBar filters={filters} onChange={setFilters} />

      {/* Tabela */}
      <LeadTable
        result={data}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeletingLead}
        onSelect={setSelectedLead}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        onAddToPipeline={setPipelineLead}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAllPage}
      />

      {/* Drawer */}
      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onEdit={handleEdit}
      />

      {/* Modais */}
      <LeadForm
        open={editingLead !== undefined}
        onClose={handleCloseForm}
        lead={editingLead ?? null}
      />

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={showExport} onClose={() => setShowExport(false)} />

      <DeleteConfirmModal
        lead={deletingLead}
        onClose={() => setDeletingLead(null)}
      />

      <AddToPipelineModal
        lead={pipelineLead}
        onClose={() => setPipelineLead(null)}
      />

      {/* Confirmação de exclusão em massa */}
      {confirmBulk && (
        <BulkConfirmModal
          count={selectedIds.size}
          label="lead"
          onCancel={() => setConfirmBulk(false)}
          onConfirm={handleBulkDelete}
          loading={removeMany.isPending}
        />
      )}
    </div>
  )
}

// ── Modal de confirmação reutilizável ──────────────────────────────────────

function BulkConfirmModal({ count, label, onCancel, onConfirm, loading }: {
  count: number; label: string; onCancel: () => void; onConfirm: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#141414', border: '1px solid #2a2a2a' }}>
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#ff4444' }}>
            Excluir {count} {label}{count !== 1 ? 's' : ''}?
          </h3>
          <p className="text-sm mt-1" style={{ color: '#888' }}>
            Esta ação não pode ser desfeita. Todos os {label}s selecionados serão excluídos permanentemente.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-40"
            style={{ color: '#aaa', border: '1px solid #2a2a2a' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,68,68,0.15)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.4)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.15)')}>
            {loading ? 'Excluindo...' : `Excluir ${count}`}
          </button>
        </div>
      </div>
    </div>
  )
}
