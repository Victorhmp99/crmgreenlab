import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import { useUsers } from '@/features/users/hooks/useUsers'
import type { GoalWithProgress } from '@/services/goals'
import type { GoalPeriod } from '@/types'

const numOrNull = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().int().min(0).nullable().optional(),
)

const schema = z.object({
  user_id:      z.string().min(1, 'Selecione um vendedor'),
  period:       z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  start_date:   z.string().min(1, 'Data de início obrigatória'),
  end_date:     z.string().min(1, 'Data de término obrigatória'),
  leads_target: numOrNull,
  calls_target: numOrNull,
  deals_target: numOrNull,
})

interface FormData {
  user_id:      string
  period:       GoalPeriod
  start_date:   string
  end_date:     string
  leads_target: number | null | undefined
  calls_target: number | null | undefined
  deals_target: number | null | undefined
}

const PERIOD_OPTIONS: { value: GoalPeriod; label: string }[] = [
  { value: 'monthly',   label: 'Mensal'     },
  { value: 'weekly',    label: 'Semanal'    },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'daily',     label: 'Diária'     },
]

function autoEndDate(period: GoalPeriod, start: string): string {
  if (!start) return ''
  const d = new Date(start + 'T12:00:00')
  switch (period) {
    case 'daily': return start
    case 'weekly': { const end = new Date(d); end.setDate(d.getDate() + 6); return end.toISOString().slice(0, 10) }
    case 'monthly': return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    case 'quarterly': return new Date(d.getFullYear(), d.getMonth() + 3, 0).toISOString().slice(0, 10)
  }
}

function suggestStartDate(period: GoalPeriod): string {
  const today = new Date()
  switch (period) {
    case 'daily': return today.toISOString().slice(0, 10)
    case 'weekly': { const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1); return mon.toISOString().slice(0, 10) }
    case 'monthly': return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
    case 'quarterly': { const q = Math.floor(today.getMonth() / 3); return new Date(today.getFullYear(), q * 3, 1).toISOString().slice(0, 10) }
  }
}

interface GoalFormProps {
  open:    boolean
  onClose: () => void
  goal?:   GoalWithProgress | null
}

export function GoalForm({ open, onClose, goal }: GoalFormProps) {
  const isEditing = !!goal
  const { create, update } = useGoalMutations()
  const { data: users = [] } = useUsers()

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<FormData>,
    defaultValues: { period: 'monthly' },
  })

  const period     = watch('period')
  const start_date = watch('start_date')

  useEffect(() => {
    const start = suggestStartDate(period as GoalPeriod)
    setValue('start_date', start)
    setValue('end_date', autoEndDate(period as GoalPeriod, start))
  }, [period, setValue])

  useEffect(() => {
    if (start_date && period) setValue('end_date', autoEndDate(period as GoalPeriod, start_date))
  }, [start_date, period, setValue])

  useEffect(() => {
    if (open && goal) {
      reset({
        user_id: goal.user_id, period: goal.period,
        start_date: goal.start_date, end_date: goal.end_date,
        leads_target: goal.leads_target, calls_target: goal.calls_target, deals_target: goal.deals_target,
      })
    } else if (open && !goal) {
      const p: GoalPeriod = 'monthly'
      const start = suggestStartDate(p)
      reset({ period: p, start_date: start, end_date: autoEndDate(p, start), leads_target: null, calls_target: null, deals_target: null })
    }
  }, [open, goal, reset])

  async function onSubmit(data: FormData) {
    const payload = {
      user_id: data.user_id, period: data.period as GoalPeriod,
      start_date: data.start_date, end_date: data.end_date,
      leads_target: data.leads_target || null,
      calls_target: data.calls_target || null,
      deals_target: data.deals_target || null,
    }
    if (isEditing) await update.mutateAsync({ id: goal.id, data: payload })
    else await create.mutateAsync(payload)
    onClose()
  }

  // Metas só podem ser atribuídas para Gestores e Vendedores ativos.
  // Admins e Super Admins gerenciam — não recebem metas.
  const userOptions = users
    .filter((u) => u.active && (u.role === 'manager' || u.role === 'seller'))
    .map((u) => ({
      value: u.userId,
      label: `${u.fullName ?? u.email} · ${u.role === 'manager' ? 'Gestor' : 'Vendedor'}`,
    }))

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEditing ? 'Editar Meta' : 'Nova Meta'}
      description="Defina as metas de desempenho para um vendedor"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button form="goal-form" type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar alterações' : 'Criar meta'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Select label="Vendedor *" options={userOptions} placeholder="Selecione um usuário"
          error={errors.user_id?.message} {...register('user_id')} />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Período *" options={PERIOD_OPTIONS} {...register('period')} />
          <Input label="Início" type="date" error={errors.start_date?.message} {...register('start_date')} />
        </div>

        <Input label="Término" type="date" error={errors.end_date?.message} {...register('end_date')} />

        {/* Métricas */}
        <div className="rounded-xl p-4 flex flex-col gap-4"
          style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#555' }}>
            Metas (deixe em branco para não monitorar)
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Leads" type="number" min={0} placeholder="—" hint="Captados" {...register('leads_target')} />
            <Input label="Disparos" type="number" min={0} placeholder="—" hint="Contatos feitos" {...register('calls_target')} />
            <Input label="Fechamentos" type="number" min={0} placeholder="—" hint="Conversões" {...register('deals_target')} />
          </div>
        </div>

        {(create.error || update.error) && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
            Erro ao salvar meta. Tente novamente.
          </p>
        )}
      </form>
    </Modal>
  )
}
