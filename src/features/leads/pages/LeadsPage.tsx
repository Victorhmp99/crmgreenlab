import { useState } from 'react'
import { UserPlus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LeadFiltersBar } from '../components/LeadFilters'
import { LeadTable } from '../components/LeadTable'
import { LeadForm } from '../components/LeadForm'
import { ImportModal } from '../components/ImportModal'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'
import { LeadDrawer } from '@/features/activities/components/LeadDrawer'
import { useLeads } from '../hooks/useLeads'
import type { Lead } from '@/types'
import type { LeadFilters } from '@/services/leads'

export function LeadsPage() {
  const [filters, setFilters]       = useState<LeadFilters>({ page: 1, pageSize: 20 })
  const [editingLead, setEditingLead]   = useState<Lead | null | undefined>(undefined)
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null)
  const [showImport, setShowImport]     = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)  // drawer

  const { data, isLoading } = useLeads(filters)

  function handleEdit(lead: Lead) {
    setSelectedLead(null)     // fecha o drawer antes
    setEditingLead(lead)
  }

  function handleCloseForm() {
    setEditingLead(undefined)
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
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Upload size={15} />
            Importar
          </Button>
          <Button onClick={() => setEditingLead(null)}>
            <UserPlus size={15} />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <LeadFiltersBar filters={filters} onChange={setFilters} />

      {/* Tabela — clique no nome abre o drawer */}
      <LeadTable
        result={data}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeletingLead}
        onSelect={setSelectedLead}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
      />

      {/* Drawer de lead com histórico de disparos */}
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

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
      />

      <DeleteConfirmModal
        lead={deletingLead}
        onClose={() => setDeletingLead(null)}
      />
    </div>
  )
}
