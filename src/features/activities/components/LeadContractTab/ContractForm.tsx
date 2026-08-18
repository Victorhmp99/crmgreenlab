import { useState, useEffect, type FormEvent } from 'react'
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

const BILLING_OPTIONS = [
  { value: 'recurring', label: 'Recorrente (mensal)' },
  { value: 'one_time',  label: 'Pagamento único' },
]

export function ContractForm({ open, onClose, leadId, leadName, contract }: Props) {
  const { create, update } = useClientContractMutations(leadId)
  const isEditing = !!contract

  const [billingType, setBillingType]         = useState<ContractBillingType>('recurring')
  const [amount, setAmount]                   = useState('')
  const [startDate, setStartDate]             = useState(new Date().toISOString().slice(0, 10))
  const [indefinite, setIndefinite]           = useState(false)
  const [installments, setInstallments]       = useState('12')
  const [isPercentage, setIsPercentage]       = useState(false)
  const [percentageValue, setPercentageValue] = useState('')

  useEffect(() => {
    if (!open) return
    if (contract) {
      setBillingType(contract.billing_type)
      setAmount(String(contract.amount))
      setStartDate(contract.start_date)
      setIndefinite(contract.installments == null)
      setInstallments(contract.installments != null ? String(contract.installments) : '12')
      setIsPercentage(contract.is_percentage)
      setPercentageValue(contract.percentage_value != null ? String(contract.percentage_value) : '')
    } else {
      setBillingType('recurring'); setAmount(''); setStartDate(new Date().toISOString().slice(0, 10))
      setIndefinite(false); setInstallments('12'); setIsPercentage(false); setPercentageValue('')
    }
  }, [open, contract])

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
