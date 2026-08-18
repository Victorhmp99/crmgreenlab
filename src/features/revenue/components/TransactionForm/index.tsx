import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { useFinancialMutations } from '../../hooks/useFinancialMutations'
import { useFinancialCategories } from '../../hooks/useFinancialCategories'
import { useFinancialProducts } from '../../hooks/useFinancialProducts'
import type { FinancialRecord } from '@/services/financial'

const schema = z.object({
  type:           z.enum(['revenue', 'expense']),
  category:       z.string().optional(),
  description:    z.string().optional(),
  amount:         z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().positive('Valor deve ser positivo')),
  date:           z.string().min(1, 'Data obrigatória'),
  expense_nature: z.enum(['fixed', 'variable', 'one_time']).optional(),
  product_id:     z.string().optional(),
})

interface FormData {
  type:            'revenue' | 'expense'
  category?:       string
  description?:    string
  amount:          number
  date:            string
  expense_nature?: 'fixed' | 'variable' | 'one_time'
  product_id?:     string
}

interface TransactionFormProps {
  open:          boolean
  onClose:       () => void
  transaction?:  FinancialRecord | null
}

const TYPE_OPTIONS = [
  { value: 'revenue', label: '💰 Receita' },
  { value: 'expense', label: '💸 Despesa' },
]

const EXPENSE_NATURE_OPTIONS = [
  { value: 'fixed',    label: 'Fixo (repete todo mês)' },
  { value: 'variable', label: 'Variável' },
  { value: 'one_time', label: 'Pontual/único' },
]

export function TransactionForm({ open, onClose, transaction }: TransactionFormProps) {
  const isEditing = !!transaction
  const { create, update } = useFinancialMutations()
  const { data: categories = [] } = useFinancialCategories()
  const { data: products = []   } = useFinancialProducts()

  const {
    register, handleSubmit, reset, watch, control, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<FormData>,
    defaultValues: { type: 'revenue', date: new Date().toISOString().slice(0, 10) },
  })

  const type   = watch('type')
  const amount = watch('amount')

  const categoryOptions = categories
    .filter((c) => c.type === type || c.type === 'both')
    .map((c) => ({ value: c.name, label: c.name }))

  const productOptions = products.map((p) => ({ value: p.id, label: p.name }))

  useEffect(() => {
    if (open && transaction) {
      reset({
        type: transaction.type, category: transaction.category ?? '',
        description: transaction.description ?? '', amount: transaction.amount, date: transaction.date,
        expense_nature: transaction.expense_nature ?? undefined,
        product_id: transaction.product_id ?? undefined,
      })
    } else if (open) {
      reset({ type: 'revenue', date: new Date().toISOString().slice(0, 10) })
    }
  }, [open, transaction, reset])

  function handleProductChange(productId: string) {
    setValue('product_id', productId)
    const product = products.find((p) => p.id === productId)
    if (product?.default_price != null && !amount) {
      setValue('amount', product.default_price)
    }
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      category: data.category || undefined,
      expense_nature: data.type === 'expense' ? data.expense_nature : undefined,
      product_id: data.type === 'revenue' ? data.product_id || undefined : undefined,
    }
    if (isEditing) {
      await update.mutateAsync({ id: transaction.id, data: payload })
    } else {
      await create.mutateAsync(payload)
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
          <Select label="Tipo *" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker label="Data *" placeholder="Selecionar" clearable={false}
                value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
        {errors.date && <p className="text-xs -mt-2" style={{ color: '#ff4444' }}>{errors.date.message}</p>}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoria"
            options={categoryOptions}
            placeholder={categoryOptions.length === 0 ? 'Nenhuma cadastrada — use Catálogo' : 'Selecionar...'}
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

        {type === 'expense' && (
          <Select
            label="Natureza do gasto"
            options={EXPENSE_NATURE_OPTIONS}
            placeholder="Selecionar..."
            {...register('expense_nature')}
          />
        )}

        {type === 'revenue' && (
          <Controller
            control={control}
            name="product_id"
            render={({ field }) => (
              <Select
                label="Produto/Serviço"
                options={productOptions}
                placeholder={productOptions.length === 0 ? 'Nenhum cadastrado — use Catálogo' : 'Selecionar...'}
                value={field.value ?? ''}
                onChange={(e) => handleProductChange(e.target.value)}
              />
            )}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Descrição
          </label>
          <textarea
            rows={2}
            placeholder="Ex: Consulta ortodontia — paciente João Silva"
            className="w-full rounded-lg px-3 py-2 text-sm resize-none transition-all focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
            onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
            {...register('description')}
          />
        </div>

        {(create.error || update.error) && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
            Erro ao salvar lançamento. Tente novamente.
          </p>
        )}
      </form>
    </Modal>
  )
}
