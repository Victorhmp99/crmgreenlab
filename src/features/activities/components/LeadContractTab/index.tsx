import { useState } from 'react'
import { FileSignature, ShoppingBag, Plus, Pencil, DollarSign, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { useLeadContract, useClientContractMutations } from '@/features/leads/hooks/useClientContracts'
import { useLeadPurchases } from '@/features/leads/hooks/useLeadPurchases'
import { useLeadMutations } from '@/features/leads/hooks/useLeadMutations'
import { getCurrentInstallment, getContractTotalValue, getContractAccruedRevenue, type ClientContract, type ContractStatus } from '@/services/clientContracts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ContractForm } from './ContractForm'
import { AddPurchaseForm } from './AddPurchaseForm'
import { ContractItems } from './ContractItems'
import type { Lead } from '@/types'

interface Props {
  lead: Lead
}

export function LeadContractTab({ lead }: Props) {
  const leadId   = lead.id
  const leadName = lead.name

  const { data: contract, isLoading }         = useLeadContract(leadId)
  const { data: purchases = [], isLoading: loadingPurchases } = useLeadPurchases(leadId)
  const { updateStatus, generateMore }         = useClientContractMutations(leadId)
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState(false)

  const hasActiveOrPaused = !!contract && contract.status !== 'cancelled'
  const contractTotal = getContractTotalValue(contract)
  const purchasesSum  = purchases.reduce((sum, p) => sum + p.amount, 0)
  const autoTotal      = contractTotal + purchasesSum
  const hasAutoSource   = hasActiveOrPaused || purchases.length > 0

  return (
    <div className="flex flex-col gap-5">
      {/* Valor do lead */}
      <LeadValueSection
        lead={lead}
        auto={hasAutoSource}
        autoTotal={autoTotal}
        contractTotal={hasActiveOrPaused ? contractTotal : 0}
        purchasesSum={purchasesSum}
      />

      {/* Contrato */}
      <div>
        <div className="flex items-center justify-between">
          <SubLabel icon={<FileSignature size={11} />}>Contrato</SubLabel>
          {hasActiveOrPaused && (
            <button onClick={() => { setEditingContract(true); setShowForm(true) }}
              className="flex items-center gap-1 text-[11px] font-medium transition-colors"
              style={{ color: '#888' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}>
              <Pencil size={10} /> Editar
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : !hasActiveOrPaused ? (
          <div className="mt-2 flex flex-col items-center gap-2 py-6 rounded-xl"
            style={{ border: '1px dashed #2a2a2a' }}>
            <p className="text-xs" style={{ color: '#555' }}>Nenhum contrato ativo</p>
            <button onClick={() => { setEditingContract(false); setShowForm(true) }}
              className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium transition-colors"
              style={{ background: 'var(--tenant-primary)', color: '#000' }}>
              <Plus size={12} /> Criar contrato
            </button>
          </div>
        ) : (
          <ContractSummary
            contract={contract}
            onUpdateStatus={(status) => updateStatus.mutate({ id: contract.id, status })}
            onGenerateMore={() => generateMore.mutate(contract.amount)}
            generatingMore={generateMore.isPending}
          />
        )}
      </div>

      {/* Produtos comprados / adicionais */}
      <div>
        <div className="flex items-center justify-between">
          <SubLabel icon={<ShoppingBag size={11} />}>Produtos e adicionais</SubLabel>
          {purchases.length > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: '#00e676' }}>
              Total: {formatCurrency(purchasesSum)}
            </span>
          )}
        </div>

        <div className="mt-2 mb-3 rounded-xl p-3" style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }}>
          <AddPurchaseForm leadId={leadId} />
        </div>

        {loadingPurchases ? (
          <div className="flex justify-center py-4"><Spinner size="sm" /></div>
        ) : purchases.length === 0 ? (
          <p className="text-xs" style={{ color: '#555' }}>Nenhuma compra registrada ainda.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ border: '1px solid #1e1e1e' }}>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: '#e8e8e8' }}>
                    {p.product_name ?? p.description ?? 'Lançamento'}
                  </p>
                  <p className="text-[11px]" style={{ color: '#666' }}>{formatDate(p.date)}</p>
                </div>
                <span className="text-sm font-semibold shrink-0 ml-2" style={{ color: '#00e676' }}>
                  {formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* key força remontar ao abrir: os campos voltam ao valor inicial pelos
          próprios useState, sem um efeito sincronizando estado. */}
      <ContractForm
        key={`${showForm}-${editingContract ? contract?.id ?? 'edit' : 'novo'}`}
        open={showForm}
        onClose={() => { setShowForm(false); setEditingContract(false) }}
        leadId={leadId}
        leadName={leadName}
        contract={editingContract ? contract : null}
      />
    </div>
  )
}

// ── Valor do lead ─────────────────────────────────────────────────────────
// Sem contrato/produtos: editável manualmente (mesmo campo do "Editar lead").
// Com contrato ou produtos: calculado sozinho (contrato + adicionais) — não editável.

function LeadValueSection({ lead, auto, autoTotal, contractTotal, purchasesSum }: {
  lead: Lead
  auto: boolean
  autoTotal: number
  contractTotal: number
  purchasesSum: number
}) {
  const { update } = useLeadMutations()
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(lead.value != null ? String(lead.value) : '')

  async function handleSave() {
    const num = value.trim() === '' ? null : Number(value.replace(',', '.'))
    await update.mutateAsync({ id: lead.id, data: { value: Number.isFinite(num) ? num : null } })
    setEditing(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <SubLabel icon={<DollarSign size={11} />}>Valor do Lead</SubLabel>
        {!auto && !editing && (
          <button onClick={() => { setValue(lead.value != null ? String(lead.value) : ''); setEditing(true) }}
            className="flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: '#888' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}>
            <Pencil size={10} /> Editar
          </button>
        )}
      </div>

      {auto ? (
        <div className="mt-1">
          <p className="text-lg font-semibold tabular-nums" style={{ color: '#00e676' }}>
            {formatCurrency(autoTotal)}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: '#666' }}>
            Calculado automaticamente
            {contractTotal > 0 && ` — contrato ${formatCurrency(contractTotal)}`}
            {purchasesSum > 0 && ` + adicionais ${formatCurrency(purchasesSum)}`}
          </p>
        </div>
      ) : editing ? (
        <div className="flex items-center gap-2 mt-2">
          <Input type="number" step="0.01" min="0" autoFocus value={value}
            onChange={(e) => setValue(e.target.value)} placeholder="0,00" className="flex-1" />
          <button onClick={handleSave} disabled={update.isPending}
            className="h-10 px-3 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ background: 'var(--tenant-primary)', color: '#000' }}>
            Salvar
          </button>
          <button onClick={() => setEditing(false)}
            className="h-10 px-3 rounded-lg text-xs font-medium" style={{ color: '#888', border: '1px solid #2a2a2a' }}>
            Cancelar
          </button>
        </div>
      ) : (
        <p className="text-lg font-semibold mt-1 tabular-nums" style={{ color: lead.value ? '#00e676' : '#555' }}>
          {lead.value != null && Number(lead.value) > 0 ? formatCurrency(Number(lead.value)) : '— não definido —'}
        </p>
      )}
    </div>
  )
}

function ContractSummary({ contract, onUpdateStatus, onGenerateMore, generatingMore }: {
  contract: ClientContract
  onUpdateStatus: (status: ContractStatus) => void
  onGenerateMore: () => void
  generatingMore: boolean
}) {
  const current     = getCurrentInstallment(contract)
  const indefinite   = contract.billing_type === 'recurring' && contract.installments == null
  const isLast       = contract.billing_type === 'recurring' && contract.installments != null && current === contract.installments
  const total        = getContractTotalValue(contract)
  const received     = getContractAccruedRevenue(contract)

  // 30 dias de antecedência: tempo de conversar com o cliente antes do
  // contrato pausar sozinho.
  const venceEmBreve = (() => {
    if (!contract.end_date || contract.status !== 'active') return false
    const dias = (new Date(contract.end_date + 'T00:00:00').getTime() - Date.now()) / 86_400_000
    return dias <= 30
  })()

  return (
    <div className="mt-2 rounded-xl px-4 py-3 flex flex-col gap-2"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
          {contract.billing_type === 'recurring' ? 'Recorrente' : 'Pagamento único'}
        </span>
        <StatusBadge status={contract.status} />
      </div>

      <div className="text-sm" style={{ color: '#ccc' }}>
        {formatCurrency(contract.amount)}{contract.billing_type === 'recurring' && '/mês'}
        {contract.is_percentage && contract.percentage_value != null && (
          <span style={{ color: '#888' }}> ({contract.percentage_value}%)</span>
        )}
      </div>

      {contract.billing_type === 'recurring' && indefinite && (
        <div className="text-xs" style={{ color: '#888' }}>
          Sem prazo determinado · mês {current} · recebido até aqui {formatCurrency(received)}
        </div>
      )}
      {contract.billing_type === 'recurring' && !indefinite && (
        <div className="text-xs" style={{ color: isLast ? '#fbbf24' : '#888' }}>
          Parcela {current}/{contract.installments} · total do contrato {formatCurrency(total)}
          {isLast && contract.status === 'active' && ' — considere renovar'}
        </div>
      )}
      {contract.billing_type === 'one_time' && (
        <div className="text-xs" style={{ color: '#888' }}>
          {received > 0 ? `Recebido: ${formatCurrency(received)}` : 'Ainda não venceu'}
        </div>
      )}

      {contract.end_date && (
        <div className="text-xs" style={{ color: venceEmBreve ? '#fbbf24' : '#888' }}>
          {contract.status === 'paused' && contract.renewal_notified_at
            ? `Venceu em ${formatDate(contract.end_date)} — pausado automaticamente`
            : `Termina em ${formatDate(contract.end_date)}`}
          {venceEmBreve && contract.status === 'active' && ' — renove antes de vencer'}
        </div>
      )}
      {contract.billing_type === 'recurring' && !indefinite && (
        <div className="text-xs" style={{ color: '#00e676' }}>
          Recebido até aqui: {formatCurrency(received)}
        </div>
      )}

      {indefinite && contract.status === 'active' && (
        <button onClick={onGenerateMore} disabled={generatingMore}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors w-fit disabled:opacity-50"
          style={{ color: '#818cf8' }}>
          <RefreshCw size={11} className={generatingMore ? 'animate-spin' : ''} />
          Gerar mais 12 meses de lembretes
        </button>
      )}

      {contract.status === 'active' && (
        <div className="flex gap-3 mt-1">
          <button onClick={() => onUpdateStatus('paused')}
            className="text-xs font-medium transition-colors" style={{ color: '#888' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}>
            Pausar
          </button>
          <button onClick={() => onUpdateStatus('cancelled')}
            className="text-xs font-medium transition-colors" style={{ color: '#ff4444' }}>
            Cancelar
          </button>
        </div>
      )}
      {contract.status === 'paused' && (
        <button onClick={() => onUpdateStatus('active')}
          className="text-xs font-medium transition-colors w-fit" style={{ color: '#00e676' }}>
          Reativar
        </button>
      )}

      <div className="mt-2 pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
        <ContractItems contractId={contract.id} contractAmount={total} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, { label: string; color: string }> = {
    active:    { label: 'Ativo',     color: '#00e676' },
    paused:    { label: 'Pausado',   color: '#fbbf24' },
    cancelled: { label: 'Cancelado', color: '#ff4444' },
    completed: { label: 'Concluído', color: '#888' },
  }
  const { label, color } = map[status]
  return (
    <span className="text-[10px] rounded-full px-2 py-0.5"
      style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {label}
    </span>
  )
}

function SubLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
      style={{ color: '#555' }}>
      {icon}
      {children}
    </p>
  )
}
