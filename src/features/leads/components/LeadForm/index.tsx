import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useLeadMutations } from '../../hooks/useLeadMutations'
import { STATUS_OPTIONS } from '../LeadStatusBadge'
import { SOURCE_OPTIONS } from '../LeadSourceBadge'
import type { Lead } from '@/types'

const schema = z.object({
  name:            z.string().min(1, 'Nome é obrigatório'),
  phone:           z.string().optional(),
  email:           z.string().email('E-mail inválido').or(z.literal('')).optional(),
  status:          z.enum(['active', 'converted', 'lost', 'archived']),
  source:          z.enum(['manual', 'import', 'meta_ads', 'google', 'referral', 'other']),
  source_campaign: z.string().optional(),
  notes:           z.string().optional(),
  tagsRaw:         z.string().optional(),   // tags como string separada por vírgula
})

type FormData = z.infer<typeof schema>

interface LeadFormProps {
  open: boolean
  onClose: () => void
  lead?: Lead | null   // null = criar, Lead = editar
}

export function LeadForm({ open, onClose, lead }: LeadFormProps) {
  const isEditing = !!lead
  const { create, update } = useLeadMutations()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active',
      source: 'manual',
    },
  })

  // Preenche o formulário ao abrir em modo edição
  useEffect(() => {
    if (open && lead) {
      reset({
        name:            lead.name,
        phone:           lead.phone ?? '',
        email:           lead.email ?? '',
        status:          lead.status,
        source:          lead.source,
        source_campaign: lead.source_campaign ?? '',
        notes:           lead.notes ?? '',
        tagsRaw:         lead.tags.join(', '),
      })
    } else if (open && !lead) {
      reset({ status: 'active', source: 'manual' })
    }
  }, [open, lead, reset])

  async function onSubmit(data: FormData) {
    const tags = data.tagsRaw
      ? data.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const payload = {
      name:            data.name,
      phone:           data.phone || undefined,
      email:           data.email || undefined,
      status:          data.status,
      source:          data.source,
      source_campaign: data.source_campaign || undefined,
      notes:           data.notes || undefined,
      tags,
    }

    if (isEditing) {
      await update.mutateAsync({ id: lead.id, data: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar Lead' : 'Novo Lead'}
      description={isEditing ? `Editando ${lead?.name}` : 'Preencha os dados do novo lead'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            form="lead-form"
            type="submit"
            loading={isSubmitting}
          >
            {isEditing ? 'Salvar alterações' : 'Criar lead'}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nome *"
          placeholder="Nome completo do lead"
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Telefone"
            placeholder="(11) 99999-9999"
            type="tel"
            {...register('phone')}
          />
          <Input
            label="E-mail"
            placeholder="lead@email.com"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            error={errors.status?.message}
            {...register('status')}
          />
          <Select
            label="Origem"
            options={SOURCE_OPTIONS}
            error={errors.source?.message}
            {...register('source')}
          />
        </div>

        <Input
          label="Campanha de origem"
          placeholder="Ex: Black Friday, Google Lead Form..."
          {...register('source_campaign')}
        />

        <Input
          label="Tags"
          placeholder="Ex: implante, clareamento (separadas por vírgula)"
          hint="Separe as tags por vírgula"
          {...register('tagsRaw')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Observações</label>
          <textarea
            rows={3}
            placeholder="Anotações sobre o lead..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 resize-none transition-colors"
            {...register('notes')}
          />
        </div>

        {(create.error || update.error) && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            Erro ao salvar lead. Tente novamente.
          </p>
        )}
      </form>
    </Modal>
  )
}
