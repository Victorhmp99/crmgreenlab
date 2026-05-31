import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useLeadMutations } from '../../hooks/useLeadMutations'
import { useLeadChannels } from '../../hooks/useLeadChannels'
import { useActiveLeadFields } from '@/features/lead-fields/hooks/useLeadFieldDefinitions'
import {
  CustomFieldsRenderer, validateCustomFields,
} from '@/features/lead-fields/components/CustomFieldsRenderer'
import { STATUS_OPTIONS } from '../LeadStatusBadge'
import { SOURCE_OPTIONS } from '../LeadSourceBadge'
import type { Lead } from '@/types'

const schema = z.object({
  name:            z.string().min(1, 'Nome é obrigatório'),
  company_name:    z.string().optional(),
  phone:           z.string().optional(),
  email:           z.string().email('E-mail inválido').or(z.literal('')).optional(),
  status:          z.enum(['active', 'converted', 'lost', 'archived']),
  source:          z.enum(['manual', 'import', 'meta_ads', 'google', 'referral', 'other']),
  source_campaign: z.string().optional(),
  channel_id:      z.string().optional(),
  value:           z.string().optional(),
  notes:           z.string().optional(),
  tagsRaw:         z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface LeadFormProps {
  open:          boolean
  onClose:       () => void
  lead?:         Lead | null
  pipelineName?: string
}

export function LeadForm({ open, onClose, lead }: LeadFormProps) {
  const isEditing = !!lead
  const { create, update } = useLeadMutations()
  const { data: channels = [] } = useLeadChannels()
  const { data: customFields = [] } = useActiveLeadFields()

  // Estado dos custom_fields (controlado fora do react-hook-form pois é dinâmico)
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({})
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  const [saveError,    setSaveError]    = useState<string | null>(null)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', source: 'manual' },
  })

  useEffect(() => {
    setSaveError(null)
    if (open && lead) {
      reset({
        name:            lead.name,
        company_name:    lead.company_name ?? '',
        phone:           lead.phone ?? '',
        email:           lead.email ?? '',
        status:          lead.status,
        source:          lead.source,
        source_campaign: lead.source_campaign ?? '',
        channel_id:      lead.channel_id ?? '',
        value:           lead.value != null ? String(lead.value) : '',
        notes:           lead.notes ?? '',
        tagsRaw:         lead.tags.join(', '),
      })
      // Pré-popula custom_fields do lead
      setCustomValues((lead.custom_fields as Record<string, unknown>) ?? {})
      setCustomErrors({})
    } else if (open && !lead) {
      reset({ status: 'active', source: 'manual', value: '', channel_id: '' })
      setCustomValues({})
      setCustomErrors({})
    }
  }, [open, lead, reset])

  async function onSubmit(data: FormData) {
    setSaveError(null)
    // Valida campos personalizados obrigatórios
    const fieldErrors = validateCustomFields(customFields, customValues)
    if (Object.keys(fieldErrors).length > 0) {
      setCustomErrors(fieldErrors)
      // Lista quais campos faltam pra mostrar no banner no topo
      const missingLabels = Object.keys(fieldErrors)
        .map((key) => customFields.find((f) => f.field_key === key)?.label ?? key)
        .filter(Boolean)
      setSaveError(
        `Preencha os campos obrigatórios: ${missingLabels.join(', ')}`,
      )
      // Rola pro topo do form pra mostrar o alerta
      requestAnimationFrame(() => {
        document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }

    const tags = data.tagsRaw
      ? data.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const valueNum = data.value && data.value.trim() !== ''
      ? Number(String(data.value).replace(',', '.'))
      : null

    const payload = {
      name:            data.name,
      company_name:    data.company_name || undefined,
      phone:           data.phone || undefined,
      email:           data.email || undefined,
      status:          data.status,
      source:          data.source,
      source_campaign: data.source_campaign || undefined,
      channel_id:      data.channel_id || null,
      value:           Number.isFinite(valueNum) ? valueNum : null,
      notes:           data.notes || undefined,
      tags,
      custom_fields:   customValues,
    }

    try {
      if (isEditing) {
        if (!lead?.id) {
          throw new Error('ID do lead não encontrado. Recarregue a página.')
        }
        await update.mutateAsync({ id: lead.id, data: payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      console.error('[LeadForm] ERRO ao salvar:', err)
      // Extrai mensagem real do erro (Supabase manda objeto com .message)
      const msg = extractErrorMessage(err)
      setSaveError(msg)
    }
  }

  function extractErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    if (typeof e === 'object' && e !== null) {
      const obj = e as Record<string, unknown>
      if (typeof obj.message === 'string') return obj.message
      if (typeof obj.details === 'string') return obj.details
      if (typeof obj.hint    === 'string') return obj.hint
      try { return JSON.stringify(obj) } catch { return String(obj) }
    }
    return 'Erro desconhecido. Veja o console (F12) para detalhes.'
  }

  // Atualiza um campo personalizado (limpa erro daquele campo)
  function handleCustomChange(fieldKey: string, value: unknown) {
    setCustomValues((prev) => ({ ...prev, [fieldKey]: value }))
    if (customErrors[fieldKey]) {
      setCustomErrors((prev) => {
        const next = { ...prev }
        delete next[fieldKey]
        return next
      })
    }
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
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button form="lead-form" type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar alterações' : 'Criar lead'}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {saveError && (
          <div className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)', color: '#ff4444' }}>
            <strong>Erro ao salvar:</strong> {saveError}
          </div>
        )}

        <Input
          label="Nome *"
          placeholder="Nome completo do lead"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Nome da empresa"
          placeholder="Ex: Clínica Sorrir, Acme Ltda..."
          {...register('company_name')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Telefone" placeholder="(11) 99999-9999" type="tel" {...register('phone')} />
          <Input label="E-mail" placeholder="lead@email.com" type="email"
            error={errors.email?.message} {...register('email')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Status" options={STATUS_OPTIONS} error={errors.status?.message} {...register('status')} />
          <Select label="Origem" options={SOURCE_OPTIONS} error={errors.source?.message} {...register('source')} />
        </div>

        <Select
          label="Canal (Inbound/Outbound/etc)"
          options={[
            { value: '', label: 'Sem categoria' },
            ...channels.map((c) => ({ value: c.id, label: c.name })),
          ]}
          {...register('channel_id')}
        />
        <p className="text-[10px] -mt-3" style={{ color: '#555' }}>
          Gerencie os canais em Configurações
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Campanha de origem"
            placeholder="Ex: Black Friday..."
            {...register('source_campaign')}
          />
          <Input
            label="Valor (R$)"
            placeholder="1500"
            type="number"
            step="0.01"
            min="0"
            hint="Opcional — apenas números (ex: 1500.50)"
            {...register('value')}
          />
        </div>

        <Input
          label="Tags"
          placeholder="Ex: implante, clareamento (separadas por vírgula)"
          hint="Separe as tags por vírgula"
          {...register('tagsRaw')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Observações
          </label>
          <textarea
            rows={3}
            placeholder="Anotações sobre o lead..."
            className="w-full rounded-lg px-3 py-2 text-sm resize-none transition-all focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
            onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
            {...register('notes')}
          />
        </div>

        {/* Campos personalizados (dinâmicos por tenant) */}
        <CustomFieldsRenderer
          values={customValues}
          onChange={handleCustomChange}
          errors={customErrors}
        />

        {(create.error || update.error) && (() => {
          const err = create.error || update.error
          const msg = err instanceof Error
            ? err.message
            : (typeof err === 'object' && err !== null && 'message' in err)
              ? String((err as { message: unknown }).message)
              : 'Erro ao salvar lead.'
          return (
            <p className="text-xs rounded-lg px-3 py-2 font-mono break-all"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
              {msg}
            </p>
          )
        })()}
      </form>
    </Modal>
  )
}
