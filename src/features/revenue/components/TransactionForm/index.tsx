import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useFinancialMutations } from '../../hooks/useFinancialMutations'
import { REVENUE_CATEGORIES, EXPENSE_CATEGORIES } from '@/services/financial'
import type { FinancialRecord } from '@/services/financial'

const schema = z.object({
  type:        z.enum(['revenue', 'expense']),
  category:    z.string().optional(),
  description: z.string().optional(),
  amount:      z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().positive('Valor deve ser positivo')),
  date:        z.string().min(1, 'Data obrigatória'),
})

interface FormData {
  type:        'revenue' | 'expense'
  category?:   string
  description?: string
  amount:      number
  date:        string
}

interface TransactionFormProps {
  open:        boolean
  onClose:     () => void
  transaction?: FinancialRecord | null
}

const TYPE_OPTIONS = [
  { value: 'revenue', label: '💰 Receita' },
  { value: 'expense', label: '💸 Despesa' },
]

export function TransactionForm({ open, onClose, transaction }: TransactionFormProps) {
  const isEditing = !!transaction
  const { create, update } = useFinancialMutations()

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<FormData>,
    defaultValues: {
      type: 'revenue',
      date: new Date().toISOString().slice(0, 10),
    },
  })

  const type = watch('type')
  const categories = type === 'revenue' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES

  useEffect(() => {
    if (open && transaction) {
      reset({
        type:        transaction.type,
        category:    transaction.category ?? '',
        description: transaction.description ?? '',
        amount:      transaction.amount,
        date:        transaction.date,
      })
    } else if (open) {
      reset({
        type: 'revenue',
        date: new Date().toISOString().slice(0, 10),
      })
    }
  }, [open, transaction, reset])

  async function onSubmit(data: FormData) {
    if (isEditing) {
      await update.mutateAsync({
        id: transaction.id,
        data: { ...data, category: data.category || undefined },
      })
    } else {
      await create.mutateAsync({ ...data, category: data.category || undefined })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button form="transaction-form" type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar' : 'Lançar'}
          </Button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo *"
            options={TYPE_OPTIONS}
            error={errors.type?.message}
            {...register('type')}
          />
          <Input
            label="Data *"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoria"
            options={categories.map((c) => ({ value: c, label: c }))}
            placeholder="Selecionar..."
            {...register('category')}
          />
          <Input
            label="Valor (R$) *"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            error={errors.amount?.message}
            {...register('amount')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Descrição</label>
          <textarea
            rows={2}
            placeholder="Ex: Consulta ortodontia — paciente João Silva"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300 resize-none transition-colors"
            {...register('description')}
          />
        </div>

        {(create.error || update.error) && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            Erro ao salvar lançamento. Tente novamente.
          </p>
        )}
      </form>
    </Modal>
  )
}
