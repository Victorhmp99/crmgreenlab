import { useState } from 'react'
import { FileText, Plus, Edit3, EyeOff, Eye, Check, X, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  useLeadFieldDefinitions, useLeadFieldMutations,
} from '@/features/lead-fields/hooks/useLeadFieldDefinitions'
import { labelToFieldKey } from '@/services/leadFieldDefinitions'
import type { LeadFieldDefinition, LeadFieldType } from '@/types'

const TYPE_OPTIONS = [
  { value: 'text',     label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number',   label: 'Número' },
  { value: 'boolean',  label: 'Sim / Não' },
  { value: 'select',   label: 'Lista de opções' },
]

const TYPE_BADGES: Record<LeadFieldType, { label: string; color: string }> = {
  text:     { label: 'Texto',    color: '#40a0ff' },
  textarea: { label: 'Texto+',   color: '#40a0ff' },
  number:   { label: '123',      color: '#a78bfa' },
  boolean:  { label: 'Sim/Não',  color: '#fbbf24' },
  select:   { label: 'Opções',   color: '#ec4899' },
}

export function LeadFieldsManager() {
  const { data: fields = [], isLoading } = useLeadFieldDefinitions()
  const { create, update, deactivate, reorder } = useLeadFieldMutations()

  const [adding, setAdding]     = useState(false)
  const [editing, setEditing]   = useState<LeadFieldDefinition | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const visible = showInactive ? fields : fields.filter((f) => f.active)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = visible.findIndex((f) => f.id === active.id)
    const newIdx = visible.findIndex((f) => f.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(visible, oldIdx, newIdx)
    const updates = reordered.map((f, i) => ({ id: f.id, position: i }))
    reorder.mutate(updates)
  }

  return (
    <section className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={15} style={{ color: 'var(--tenant-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Campos personalizados do lead
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInactive((v) => !v)}
            className="text-[11px] flex items-center gap-1 rounded-lg px-2 py-1 transition-all"
            style={{ color: 'var(--text-dim)' }}>
            {showInactive ? <Eye size={11} /> : <EyeOff size={11} />}
            {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
          </button>
          {!adding && !editing && (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-all"
              style={{
                background: 'rgba(0,230,118,0.08)',
                color: '#00e676',
                border: '1px solid rgba(0,230,118,0.2)',
              }}>
              <Plus size={12} /> Novo campo
            </button>
          )}
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Adicione campos personalizados ao formulário de lead. Tipo e identificador
        não podem ser alterados após criação. Desative para ocultar sem perder dados.
      </p>

      {/* Form de criar */}
      {adding && (
        <FieldForm
          mode="create"
          onSave={async (data) => {
            await create.mutateAsync(data)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
          saving={create.isPending}
        />
      )}

      {/* Form de editar */}
      {editing && (
        <FieldForm
          mode="edit"
          field={editing}
          onSave={async (data) => {
            await update.mutateAsync({
              id: editing.id,
              data: {
                label:    data.label,
                options:  data.options ?? null,
                required: data.required,
              },
            })
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
          saving={update.isPending}
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>Carregando...</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>
          Nenhum campo {showInactive ? '' : 'ativo'}.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {visible.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  onEdit={() => setEditing(field)}
                  onDeactivate={() => deactivate.mutate(field.id)}
                  onReactivate={() => update.mutate({ id: field.id, data: { active: true } })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

// ── Linha de campo (sortable) ────────────────────────────────────────────────

function FieldRow({ field, onEdit, onDeactivate, onReactivate }: {
  field:        LeadFieldDefinition
  onEdit:       () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : (field.active ? 1 : 0.5),
    background: 'var(--bg-surface2)',
    border:     '1px solid var(--border-dim)',
  }

  const typeBadge = TYPE_BADGES[field.field_type]

  return (
    <div ref={setNodeRef} style={style}
      className="rounded-lg px-3 py-2 flex items-center gap-3 group">
      {/* Drag handle */}
      <button {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-dim)' }}>
        <GripVertical size={13} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
            {field.label}
          </span>
          {field.required && (
            <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5"
              style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>
              OBRIGATÓRIO
            </span>
          )}
          <span className="text-[9px] font-medium rounded-full px-1.5 py-0.5"
            style={{ background: `${typeBadge.color}22`, color: typeBadge.color }}>
            {typeBadge.label}
          </span>
          {!field.active && (
            <span className="text-[9px] font-medium rounded-full px-1.5 py-0.5"
              style={{ background: 'rgba(150,150,150,0.15)', color: 'var(--text-dim)' }}>
              INATIVO
            </span>
          )}
        </div>
        <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-faint)' }}>
          {field.field_key}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} title="Editar"
          className="h-7 w-7 rounded flex items-center justify-center"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#40a0ff'; e.currentTarget.style.background = 'rgba(64,160,255,0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}>
          <Edit3 size={12} />
        </button>
        {field.active ? (
          <button onClick={onDeactivate} title="Desativar (preserva dados)"
            className="h-7 w-7 rounded flex items-center justify-center"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}>
            <EyeOff size={12} />
          </button>
        ) : (
          <button onClick={onReactivate} title="Reativar"
            className="h-7 w-7 rounded flex items-center justify-center"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#00e676'; e.currentTarget.style.background = 'rgba(0,230,118,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}>
            <Eye size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Form de criar/editar campo ───────────────────────────────────────────────

interface FieldFormData {
  label:      string
  field_key:  string
  field_type: LeadFieldType
  options?:   string[] | null
  required:   boolean
}

function FieldForm({ mode, field, onSave, onCancel, saving }: {
  mode:     'create' | 'edit'
  field?:   LeadFieldDefinition
  onSave:   (data: FieldFormData) => Promise<void>
  onCancel: () => void
  saving:   boolean
}) {
  const isEdit = mode === 'edit'
  const [label,     setLabel]     = useState(field?.label ?? '')
  const [fieldKey,  setFieldKey]  = useState(field?.field_key ?? '')
  const [fieldType, setFieldType] = useState<LeadFieldType>(field?.field_type ?? 'text')
  const [optionsRaw, setOptionsRaw] = useState(field?.options?.join('\n') ?? '')
  const [required,  setRequired]  = useState(field?.required ?? false)
  const [err,       setErr]       = useState<string | null>(null)

  // Auto-gera field_key a partir do label, só na criação
  function handleLabelChange(v: string) {
    setLabel(v)
    if (!isEdit) setFieldKey(labelToFieldKey(v))
  }

  async function handleSubmit() {
    setErr(null)
    if (!label.trim()) { setErr('O label é obrigatório'); return }
    if (!isEdit && !fieldKey.trim()) { setErr('O identificador é obrigatório'); return }

    const options = fieldType === 'select'
      ? optionsRaw.split('\n').map((o) => o.trim()).filter(Boolean)
      : null

    if (fieldType === 'select' && (!options || options.length === 0)) {
      setErr('Adicione pelo menos uma opção para o tipo "Lista de opções"'); return
    }

    try {
      await onSave({ label: label.trim(), field_key: fieldKey.trim(), field_type: fieldType, options, required })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  return (
    <div className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-surface2)', border: '1px solid rgba(0,230,118,0.2)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {isEdit ? 'Editar campo' : 'Novo campo'}
      </p>

      <Input
        label="Pergunta / Label *"
        placeholder="Ex: Qual sua especialidade?"
        value={label}
        onChange={(e) => handleLabelChange(e.target.value)}
      />

      <Input
        label="Identificador interno (field_key) *"
        placeholder="ex: especialidade"
        hint={isEdit
          ? 'Não pode ser alterado após criação'
          : 'Auto-gerado pelo label — só letras minúsculas, números e underscore'}
        value={fieldKey}
        onChange={(e) => setFieldKey(e.target.value)}
        disabled={isEdit}
      />

      <Select
        label={isEdit ? 'Tipo (não pode ser alterado)' : 'Tipo *'}
        value={fieldType}
        onChange={(e) => setFieldType(e.target.value as LeadFieldType)}
        options={TYPE_OPTIONS}
        disabled={isEdit}
      />

      {fieldType === 'select' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Opções (uma por linha)
          </label>
          <textarea
            rows={3}
            value={optionsRaw}
            onChange={(e) => setOptionsRaw(e.target.value)}
            placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
            className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="accent-[var(--tenant-primary)]"
        />
        <span className="text-xs" style={{ color: 'var(--text)' }}>
          Obrigatório no formulário
        </span>
      </label>

      {err && (
        <p className="text-xs rounded-lg px-3 py-2"
          style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>{err}</p>
      )}

      <div className="flex justify-end gap-2 mt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X size={12} /> Cancelar
        </Button>
        <Button size="sm" onClick={handleSubmit} loading={saving}>
          <Check size={12} /> {isEdit ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </div>
  )
}
