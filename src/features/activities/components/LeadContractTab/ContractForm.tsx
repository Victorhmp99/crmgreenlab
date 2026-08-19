import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { useClientContractMutations } from '@/features/leads/hooks/useClientContracts'
import type { ClientContract, ContractBillingType } from '@/services/clientContracts'

interface Props {
  open:     boolean
  onClose:  () => void
  leadId:   string
  leadName: string
  /** Quando presente, o form abre em modo edição desse contrato */
  contract?: ClientContract | null
}

/** Data de hoje no fuso local — toISOString() usaria UTC e adiantaria o dia. */
function todayISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const BILLING_OPTIONS = [
  { value: 'recurring', label: 'Recorrente (mensal)' },
  { value: 'one_time',  label: 'Pagamento único' },
]

export function ContractForm({ open, onClose, leadId, leadName, contract }: Props) {
  const { create, update } = useClientContractMutations(leadId)
  const isEditing = !!contract

  // Valores iniciais lidos uma vez, na montagem. O componente é remontado por
  // `key` quando o modal abre, então não há efeito sincronizando props com
  // estado — que é o padrão que dispara render em cascata.
  const [billingType, setBillingType]         = useState<ContractBillingType>(contract?.billing_type ?? 'recurring')
  const [amount, setAmount]                   = useState(contract ? String(contract.amount) : '')
  const [startDate, setStartDate]             = useState(contract?.start_date ?? todayISO())
  const [indefinite, setIndefinite]           = useState(contract ? contract.installments == null : false)
  const [installments, setInstallments]       = useState(
    contract?.installments != null ? String(contract.installments) : '12',
  )
  const [isPercentage, setIsPercentage]       = useState(contract?.is_percentage ?? false)
  const [percentageValue, setPercentageValue] = useState(
    contract?.percentage_value != null ? String(contract.percentage_value) : '',
  )
  const [endDate, setEndDate]                 = useState(contract?.end_date ?? '')

  function resolveInstallments(): number | null {
    if (billingType === 'one_time') return 1
    if (indefinite) return null
    return Math.max(1, Number(installments) || 12)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!amount) return

    const payload = {
      billing_type:     billingType,
      is_percentage:    isPercentage,
      percentage_value: isPercentage && percentageValue ? Number(percentageValue) : null,
      amount:           Number(amount),
      installments:     resolveInstallments(),
      start_date:       startDate,
      end_date:         endDate || null,
    }

    if (isEditing && contract) {
      await update.mutateAsync({ id: contract.id, data: payload })
    } else {
      await create.mutateAsync({ lead_id: leadId, ...payload })
    }
    onClose()
  }

  const pending = create.isPending || update.isPending
  const error   = create.error || update.error

  // Contrato retroativo: as parcelas que já passaram contam como recebidas,
  // mas não geram lembrete de cobrança (não faz sentido cobrar mês passado)
  const todayStr  = new Date().toLocaleDateString('en-CA') // yyyy-mm-dd local
  const isBackdated = !isEditing && startDate < todayStr

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar Contrato' : 'Criar Contrato'}
      description={leadName}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button form="contract-form" type="submit" loading={pending} disabled={!amount}>
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form id="contract-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEditing && (
          <p className="text-xs rounded-lg px-3 py-2"
            style={{ color: '#818cf8', background: 'rgba(99,102,241,0.08)' }}>
            Editar aqui só atualiza o contrato — as tarefas de cobrança já geradas continuam com os valores originais.
          </p>
        )}

        <Select
          label="Tipo de cobrança"
          value={billingType}
          onChange={(e) => setBillingType(e.target.value as ContractBillingType)}
          options={BILLING_OPTIONS}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Valor (R$) *" type="number" step="0.01" min="0" placeholder="0,00"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
          <DatePicker label="Data início *" placeholder="Selecionar" clearable={false}
            value={startDate} onChange={(v) => v && setStartDate(v)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <DatePicker label="Data de término" placeholder="Sem prazo de término"
            value={endDate} onChange={setEndDate} minDate={startDate} />
          <p className="text-xs leading-relaxed" style={{ color: '#666' }}>
            {endDate
              ? 'Ao chegar essa data, o contrato é pausado sozinho e vira uma tarefa de renovação — pausado, não cancelado, então dá pra retomar.'
              : 'Opcional. Preencha para ser lembrado de renovar quando o contrato acabar.'}
          </p>
        </div>

        {billingType === 'recurring' && (
          <>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: '#ccc' }}>
              <input type="checkbox" checked={indefinite}
                onChange={(e) => setIndefinite(e.target.checked)}
                className="h-4 w-4 rounded" />
              Sem prazo determinado (continua até eu cancelar)
            </label>

            {indefinite ? (
              <p className="text-xs rounded-lg px-3 py-2" style={{ color: '#888', background: '#141414', border: '1px solid #1e1e1e' }}>
                Gera lembretes de cobrança pros próximos 12 meses. Quando estiverem acabando, você pode gerar mais
                — os lembretes só param de vez quando você cancelar o contrato.
              </p>
            ) : (
              <Input
                label="Número de meses"
                type="number" min="1" value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                hint="Gera 1 lembrete de cobrança por mês. Perto do fim, avisa pra renovar."
              />
            )}
          </>
        )}

        {isBackdated && (
          <p className="text-xs rounded-lg px-3 py-2"
            style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.08)' }}>
            Data retroativa: as parcelas que já passaram entram como recebidas e somam no valor
            do lead, mas <strong>não geram lembrete de cobrança</strong>. Só o que vence de hoje
            em diante vira tarefa.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: '#ccc' }}>
          <input type="checkbox" checked={isPercentage}
            onChange={(e) => setIsPercentage(e.target.checked)}
            className="h-4 w-4 rounded" />
          Cobrança é percentual sobre performance do cliente
        </label>

        {isPercentage && (
          <Input
            label="Percentual (%)"
            type="number" step="0.1" min="0" max="100" placeholder="Ex: 15"
            value={percentageValue} onChange={(e) => setPercentageValue(e.target.value)}
            hint="Só pra referência — o valor lançado continua sendo o campo acima"
          />
        )}

        {error && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
            Erro ao salvar contrato. Tente novamente.
          </p>
        )}
      </form>
    </Modal>
  )
}
