import { useState } from 'react'
import { Filter, Plus, Edit3, Trash2, Check, X, GripVertical, AlertTriangle, Wand2 } from 'lucide-react'
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
import {
  useFunnelSteps, useFunnelStepMutations,
} from '../hooks/useFunnelSteps'
import type { FunnelStep, ActivityType } from '@/types'

const PRESET_COLORS = [
  '#888888','#40a0ff','#a78bfa','#fbbf24','#ec4899','#ff4444','#14B8A6','#f97316','#00e676',
]

export function FunnelStepsManager() {
  const { data: steps = [], isLoading } = useFunnelSteps()
  const { create, update, remove, reorder } = useFunnelStepMutations()

  const [adding,   setAdding]   = useState(false)
  const [editing,  setEditing]  = useState<FunnelStep | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = steps.findIndex((s) => s.id === active.id)
    const newIdx = steps.findIndex((s) => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(steps, oldIdx, newIdx)
    reorder.mutate(reordered.map((s, i) => ({ id: s.id, position: i })))
  }

  const existingNames = steps.map((s) => s.name.toLowerCase())

  return (
    <section className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={15} style={{ color: 'var(--tenant-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Passos do funil
          </h3>
          <span className="text-[10px] rounded-full px-1.5 py-0.5"
            style={{ background: 'var(--bg-surface3)', color: 'var(--text-dim)' }}>
            {steps.length}
          </span>
        </div>
        {!adding && !editing && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-all"
            style={{
              background: 'rgba(0,230,118,0.08)', color: '#00e676',
              border: '1px solid rgba(0,230,118,0.2)',
            }}>
            <Plus size={12} /> Novo passo
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Você já tem <strong style={{ color: 'var(--text)' }}>{steps.length} passos</strong> configurados.
        Use o ícone de lápis para editar (clica em cima quando passa o mouse), arrasta para reordenar,
        ou clica em "Novo passo" para adicionar mais. Cada nome deve ser único.
      </p>

      {adding && (
        <StepForm
          mode="create"
          existingNames={existingNames}
          onSave={async (data) => { await create.mutateAsync(data); setAdding(false) }}
          onCancel={() => setAdding(false)}
          saving={create.isPending}
        />
      )}

      {editing && (
        <StepForm
          mode="edit"
          step={editing}
          existingNames={existingNames.filter((n) => n !== editing.name.toLowerCase())}
          onSave={async (data) => {
            await update.mutateAsync({ id: editing.id, data })
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
          saving={update.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>Carregando...</p>
      ) : steps.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>
          Nenhum passo cadastrado.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {steps.map((step, idx) => (
                <StepRow
                  key={step.id}
                  step={step}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === steps.length - 1}
                  onEdit={() => setEditing(step)}
                  onDelete={() => {
                    if (confirm(`Excluir "${step.name}"? Etapas mapeadas para este passo ficarão sem mapping.`)) {
                      remove.mutate(step.id)
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

// ── Linha do step (sortable) ─────────────────────────────────────────────────

function StepRow({ step, index, isFirst, isLast, onEdit, onDelete }: {
  step:     FunnelStep
  index:    number
  isFirst:  boolean
  isLast:   boolean
  onEdit:   () => void
  onDelete: () => void
}) {
  // Passo precisa de activity_types se NÃO for o primeiro (todo lead cai no primeiro)
  // e NÃO for o último (último captura convertidos automaticamente).
  const hasActivities  = !!step.activity_types && step.activity_types.length > 0
  const needsActivities = !isFirst && !isLast && !hasActivities
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    background: 'var(--bg-surface2)',
    border:     '1px solid var(--border-dim)',
  }

  return (
    <div ref={setNodeRef} style={style}
      className="rounded-lg px-3 py-2 flex items-center gap-3 group">
      <button {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-dim)' }}>
        <GripVertical size={13} />
      </button>

      <span className="text-xs tabular-nums w-5 text-center" style={{ color: 'var(--text-dim)' }}>
        {index + 1}
      </span>

      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: step.color }} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
          {step.name}
        </p>
        {step.description && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>
            {step.description}
          </p>
        )}
        {hasActivities && (
          <div className="flex flex-wrap gap-1 mt-1">
            {step.activity_types!.map((t) => (
              <span key={t} className="text-[10px] rounded-full px-1.5 py-0.5"
                style={{ background: 'rgba(64,160,255,0.1)', color: '#40a0ff', border: '1px solid rgba(64,160,255,0.2)' }}>
                {ACTIVITY_TYPE_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        )}
        {needsActivities && (
          <div className="flex items-center gap-1 mt-1 text-[10px] rounded-md px-1.5 py-0.5 w-fit"
            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
            <AlertTriangle size={10} />
            Sem disparos configurados — não conta no funil. Clique no lápis para configurar.
          </div>
        )}
        {isFirst && !hasActivities && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
            Captura todos os leads ativos (primeiro passo).
          </p>
        )}
        {isLast && !hasActivities && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
            Captura leads convertidos automaticamente (último passo).
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} title="Editar"
          className="h-7 w-7 rounded flex items-center justify-center"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#40a0ff'; e.currentTarget.style.background = 'rgba(64,160,255,0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}>
          <Edit3 size={12} />
        </button>
        <button onClick={onDelete} title="Excluir"
          className="h-7 w-7 rounded flex items-center justify-center"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Form de criar/editar ─────────────────────────────────────────────────────

interface StepFormData {
  name:           string
  description:    string | null
  color:          string
  activity_types: ActivityType[] | null
}

const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'call',     label: 'Ligação' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email',    label: 'E-mail' },
  { value: 'meeting',  label: 'Reunião' },
  { value: 'note',     label: 'Nota' },
]

const ACTIVITY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

function StepForm({ mode, step, existingNames, onSave, onCancel, saving }: {
  mode:          'create' | 'edit'
  step?:         FunnelStep
  existingNames: string[]
  onSave:        (data: StepFormData) => Promise<void>
  onCancel:      () => void
  saving:        boolean
}) {
  const [name,        setName]        = useState(step?.name ?? '')
  const [description, setDescription] = useState(step?.description ?? '')
  const [color,       setColor]       = useState(step?.color ?? '#40a0ff')
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>(step?.activity_types ?? [])
  const [err,         setErr]         = useState<string | null>(null)

  const trimmedLower = name.trim().toLowerCase()
  const isDuplicate  = trimmedLower !== '' && existingNames.includes(trimmedLower)

  function toggleActivityType(t: ActivityType) {
    setActivityTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    )
  }

  // Sugere disparos com base no nome do passo
  function suggestActivityTypes() {
    const n = name.trim().toLowerCase()
    if (!n) return
    const suggestions: ActivityType[] = []
    if (n.includes('contato') || n.includes('contact') || n.includes('primeiro'))
      suggestions.push('call', 'whatsapp', 'email')
    if (n.includes('reuni') || n.includes('agenda') || n.includes('meeting') || n.includes('call'))
      suggestions.push('meeting')
    if (n.includes('negoci') || n.includes('propost') || n.includes('orçament') || n.includes('orcament'))
      suggestions.push('meeting', 'call')
    if (n.includes('whats')) suggestions.push('whatsapp')
    if (n.includes('email') || n.includes('e-mail')) suggestions.push('email')
    if (n.includes('liga')) suggestions.push('call')
    // dedup
    setActivityTypes(Array.from(new Set(suggestions)))
  }

  async function handleSubmit() {
    if (!name.trim()) { setErr('Nome obrigatório'); return }
    if (isDuplicate)  { setErr(`Já existe um passo com nome "${name.trim()}". Use outro.`); return }
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        color,
        activity_types: activityTypes.length > 0 ? activityTypes : null,
      })
    } catch (e) {
      // Extrai mensagem do erro (Error, objeto Supabase, ou string)
      const raw = extractErrorMessage(e)
      console.error('[FunnelStep] erro completo:', e)

      if (raw.includes('duplicate key') || raw.includes('unique')) {
        setErr(`Já existe um passo com o nome "${name.trim()}". Use outro nome.`)
      } else if (raw.includes('row-level security') || raw.includes('policy')) {
        setErr('Sem permissão. Apenas Admin/Gestor pode gerenciar passos do funil.')
      } else {
        setErr(raw || 'Erro desconhecido. Veja o console (F12) para detalhes.')
      }
    }
  }

  function extractErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    if (typeof e === 'object' && e !== null) {
      const obj = e as Record<string, unknown>
      // Supabase errors têm 'message', 'details', 'hint', 'code'
      if (typeof obj.message === 'string') return obj.message
      if (typeof obj.details === 'string') return obj.details
      if (typeof obj.hint === 'string')    return obj.hint
      try { return JSON.stringify(obj) } catch { return String(obj) }
    }
    return String(e)
  }

  return (
    <div className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-surface2)', border: '1px solid rgba(0,230,118,0.2)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {mode === 'edit' ? 'Editar passo' : 'Novo passo'}
      </p>

      <Input
        label="Nome do passo *"
        placeholder="Ex: Qualificação, Proposta enviada, Negociação"
        hint={isDuplicate
          ? `⚠️ "${name.trim()}" já existe. Use outro nome.`
          : 'Nome deve ser único'}
        error={isDuplicate ? ' ' : undefined}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Input
        label="Descrição (opcional)"
        placeholder="Ex: Cliente respondeu ao primeiro contato"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Cor
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#ffffff' : 'transparent',
                transform: color === c ? 'scale(1.15)' : undefined,
              }} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Atividades que contam para esse passo (disparos)
          </label>
          <button type="button" onClick={suggestActivityTypes} disabled={!name.trim()}
            className="flex items-center gap-1 text-[11px] rounded-md px-2 py-1 transition-all disabled:opacity-40"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
            <Wand2 size={11} /> Sugerir pelo nome
          </button>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
          Quando o lead tiver uma destas atividades registradas, ele alcança este passo do funil.
          Deixe vazio para passos que não dependem de atividade (ex: "Leads captados" — todos contam; "Fechado" — leads convertidos).
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_TYPE_OPTIONS.map((opt) => {
            const checked = activityTypes.includes(opt.value)
            return (
              <button key={opt.value} type="button" onClick={() => toggleActivityType(opt.value)}
                className="text-xs rounded-lg px-2.5 py-1 transition-all"
                style={{
                  background: checked ? 'rgba(0,230,118,0.12)' : 'var(--bg-surface3)',
                  color:      checked ? '#00e676' : 'var(--text-dim)',
                  border:     checked ? '1px solid rgba(0,230,118,0.4)' : '1px solid var(--border-dim)',
                }}>
                {checked ? '✓ ' : ''}{opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {err && (
        <p className="text-xs rounded-lg px-3 py-2"
          style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>{err}</p>
      )}

      <div className="flex justify-end gap-2 mt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X size={12} /> Cancelar
        </Button>
        <Button size="sm" onClick={handleSubmit} loading={saving}
          disabled={!name.trim() || isDuplicate}>
          <Check size={12} /> {mode === 'edit' ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </div>
  )
}
