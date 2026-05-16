import { useActiveLeadFields } from '../hooks/useLeadFieldDefinitions'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { LeadFieldDefinition } from '@/types'

interface CustomFieldsRendererProps {
  /** Valores atuais dos custom fields, indexados por field_key */
  values:    Record<string, unknown>
  /** Callback ao alterar um valor */
  onChange:  (fieldKey: string, value: unknown) => void
  /** Mostra erros de validação (campos required vazios), indexados por field_key */
  errors?:   Record<string, string>
}

/** Renderiza os campos personalizados ativos do tenant */
export function CustomFieldsRenderer({ values, onChange, errors = {} }: CustomFieldsRendererProps) {
  const { data: fields = [], isLoading } = useActiveLeadFields()

  if (isLoading || fields.length === 0) return null

  return (
    <div className="flex flex-col gap-4 mt-1 pt-4"
      style={{ borderTop: '1px dashed var(--border)' }}>
      <p className="text-[10px] uppercase tracking-widest font-semibold"
        style={{ color: 'var(--text-muted)' }}>
        Informações adicionais
      </p>
      {fields.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          value={values[field.field_key]}
          onChange={(v) => onChange(field.field_key, v)}
          error={errors[field.field_key]}
        />
      ))}
    </div>
  )
}

/** Renderiza um único campo conforme seu tipo */
function FieldRenderer({ field, value, onChange, error }: {
  field:    LeadFieldDefinition
  value:    unknown
  onChange: (v: unknown) => void
  error?:   string
}) {
  const labelText = field.label + (field.required ? ' *' : '')

  switch (field.field_type) {
    case 'number':
      return (
        <Input
          label={labelText}
          type="number"
          step="any"
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? null : Number(v))
          }}
          error={error}
        />
      )

    case 'boolean':
      return (
        <Select
          label={labelText}
          value={value == null ? '' : value === true ? 'yes' : 'no'}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? null : v === 'yes')
          }}
          options={[
            { value: '',    label: '— Selecione —' },
            { value: 'yes', label: 'Sim' },
            { value: 'no',  label: 'Não' },
          ]}
          error={error}
        />
      )

    case 'select':
      return (
        <Select
          label={labelText}
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          options={[
            { value: '', label: '— Selecione —' },
            ...(field.options ?? []).map((opt) => ({ value: opt, label: opt })),
          ]}
          error={error}
        />
      )

    case 'textarea':
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}>
            {labelText}
          </label>
          <textarea
            rows={3}
            value={value == null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
            style={{
              background: 'var(--bg-input)',
              border:     `1px solid ${error ? '#ff4444' : 'var(--border)'}`,
              color:      'var(--text)',
            }}
          />
          {error && <p className="text-xs" style={{ color: '#ff4444' }}>{error}</p>}
        </div>
      )

    case 'text':
    default:
      return (
        <Input
          label={labelText}
          type="text"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          error={error}
        />
      )
  }
}

/** Valida custom_fields contra as definições. Retorna erros por field_key. */
export function validateCustomFields(
  fields: LeadFieldDefinition[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    if (!field.active) continue
    if (!field.required) continue
    const v = values[field.field_key]
    if (v === null || v === undefined || v === '') {
      errors[field.field_key] = 'Campo obrigatório'
    }
  }
  return errors
}
