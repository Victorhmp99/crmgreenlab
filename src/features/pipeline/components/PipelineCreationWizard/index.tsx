import { useState, useRef, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Plus, Trash2, GripVertical, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  createPipelineEmpty,
  createStage,
  updatePipeline,
  updateStage,
  deleteStage,
} from '@/services/pipelineManagement'
import type { PipelineStage } from '@/types'

// ── Constantes ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#00e676', '#40a0ff', '#a78bfa', '#fbbf24',
  '#ec4899', '#ff4444', '#14B8A6', '#f97316',
]

const STEP_COUNT = 2

// ── Tipos internos ────────────────────────────────────────────────────────────

interface StageRow {
  id?:     string   // presente para etapas já existentes no banco
  key:     string   // chave local para renderização React
  name:    string
  color:   string
  isStart: boolean  // etapa de entrada (start_stage_id)
  isFinal: boolean  // etapa de conversão (is_final=true)
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

// ── Step 1 — Nome & Cor ───────────────────────────────────────────────────────

function Step1Name({
  name,    onName,
  color,   onColor,
  isEdit,
}: {
  name:    string; onName:  (v: string) => void
  color:   string; onColor: (v: string) => void
  isEdit:  boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-lg mx-auto px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#e8e8e8' }}>
          {isEdit ? 'Edite o nome\ndo seu fluxo.' : 'Vamos dar um nome\nao seu fluxo.'}
        </h1>
      </div>

      {/* Nome em destaque */}
      <div className="w-full text-center">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Nome da pipeline..."
          maxLength={40}
          className="w-full text-3xl font-bold text-center bg-transparent border-0 border-b-2 focus:outline-none pb-2 transition-colors placeholder:opacity-30"
          style={{
            color:       'var(--tenant-primary)',
            borderColor: name ? 'var(--tenant-primary)' : '#333',
          }}
        />
        <p className="text-xs mt-3 uppercase tracking-widest" style={{ color: '#555' }}>
          CÓDIGO: {name.slice(0, 3).toUpperCase() || '···'}
        </p>
      </div>

      {/* Seletor de cor */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColor(c)}
            className="h-7 w-7 rounded-full border-2 transition-all"
            style={{
              backgroundColor: c,
              borderColor: color === c ? '#e8e8e8' : 'transparent',
              transform:   color === c ? 'scale(1.25)' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step 2 — Etapas ───────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
        style={{ backgroundColor: value, borderColor: '#444' }}
        title="Mudar cor"
      />
      {open && (
        <div
          className="absolute left-0 top-9 z-20 p-2 rounded-xl flex flex-wrap gap-1.5"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: 120 }}
          onClick={(e) => e.stopPropagation()}
        >
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false) }}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: value === c ? '#e8e8e8' : 'transparent',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Step2Stages({
  stages, onStages,
}: {
  stages:   StageRow[]
  onStages: (s: StageRow[]) => void
}) {
  function addStage() {
    const color = PRESET_COLORS[stages.length % PRESET_COLORS.length]
    onStages([...stages, { key: uid(), name: '', color, isStart: false, isFinal: false }])
  }

  function update(key: string, patch: Partial<StageRow>) {
    onStages(stages.map((s) => s.key === key ? { ...s, ...patch } : s))
  }

  function remove(key: string) {
    if (stages.length <= 1) return
    onStages(stages.filter((s) => s.key !== key))
  }

  function setStart(key: string) {
    onStages(stages.map((s) => ({ ...s, isStart: s.key === key })))
  }

  function setFinal(key: string) {
    onStages(stages.map((s) => ({ ...s, isFinal: s.key === key })))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...stages]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onStages(next)
  }

  function moveDown(idx: number) {
    if (idx === stages.length - 1) return
    const next = [...stages]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onStages(next)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#e8e8e8' }}>
          Estruture suas etapas.
        </h1>
        <p className="text-sm mt-2" style={{ color: '#555' }}>
          Defina as colunas do kanban. Marque a etapa de{' '}
          <span style={{ color: '#40a0ff' }}>entrada</span> e a etapa de{' '}
          <span style={{ color: '#00e676' }}>conversão</span> para automações funcionarem.
        </p>
      </div>

      {/* Lista de etapas */}
      <div className="w-full flex flex-col gap-2">
        {stages.map((stage, idx) => (
          <div
            key={stage.key}
            className="flex items-center gap-3 rounded-xl px-4 py-3 group"
            style={{
              background:  '#161616',
              border:      `1px solid ${stage.isStart ? '#40a0ff44' : stage.isFinal ? '#00e67644' : '#2a2a2a'}`,
              transition:  'border-color 0.15s',
            }}
          >
            {/* Reorder */}
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveUp(idx)} disabled={idx === 0}
                className="h-4 w-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                style={{ color: '#555' }}>
                <ChevronLeft size={10} style={{ transform: 'rotate(90deg)' }} />
              </button>
              <button onClick={() => moveDown(idx)} disabled={idx === stages.length - 1}
                className="h-4 w-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                style={{ color: '#555' }}>
                <ChevronLeft size={10} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </div>

            {/* Grip icon */}
            <GripVertical size={14} style={{ color: '#333', flexShrink: 0 }} />

            {/* Cor */}
            <ColorPicker
              value={stage.color}
              onChange={(c) => update(stage.key, { color: c })}
            />

            {/* Nome */}
            <input
              value={stage.name}
              onChange={(e) => update(stage.key, { name: e.target.value })}
              placeholder={`Etapa ${idx + 1}...`}
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: '#e8e8e8', caretColor: 'var(--tenant-primary)' }}
            />

            {/* Badge Início */}
            <button
              onClick={() => setStart(stage.key)}
              title="Marcar como etapa de entrada"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all"
              style={stage.isStart
                ? { background: 'rgba(64,160,255,0.15)', color: '#40a0ff', border: '1px solid rgba(64,160,255,0.4)' }
                : { background: 'transparent', color: '#333', border: '1px solid #2a2a2a' }}
            >
              {stage.isStart && <Check size={9} />}
              Início
            </button>

            {/* Badge Final */}
            <button
              onClick={() => setFinal(stage.key)}
              title="Marcar como etapa de conversão"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all"
              style={stage.isFinal
                ? { background: 'rgba(0,230,118,0.15)', color: '#00e676', border: '1px solid rgba(0,230,118,0.4)' }
                : { background: 'transparent', color: '#333', border: '1px solid #2a2a2a' }}
            >
              {stage.isFinal && <Check size={9} />}
              Final
            </button>

            {/* Delete */}
            <button
              onClick={() => remove(stage.key)}
              disabled={stages.length <= 1}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-20"
              style={{ color: '#333' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#333')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {/* + Nova etapa */}
        <button
          onClick={addStage}
          className="flex items-center gap-2 rounded-xl px-4 py-3 w-full text-sm transition-colors"
          style={{ border: '2px dashed #2a2a2a', color: '#555' }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--tenant-primary)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--tenant-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#555'
          }}
        >
          <Plus size={14} />
          Nova etapa
        </button>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[11px]" style={{ color: '#444' }}>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: '#40a0ff' }} />
          Início = leads entram aqui via automação
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: '#00e676' }} />
          Final = lead vira <strong style={{ color: '#00e676' }}>Convertido</strong> automaticamente
        </span>
      </div>
    </div>
  )
}

// ── Props do wizard ───────────────────────────────────────────────────────────

interface EditInitialData {
  pipeline: {
    id:             string
    name:           string
    color:          string
    start_stage_id: string | null
  }
  stages: PipelineStage[]
}

interface Props {
  onClose:      () => void
  /** Modo criação */
  onCreated?:   (pipelineId: string) => void
  /** Modo edição */
  onSaved?:     () => void
  /** Se presente, abre em modo edição */
  editData?:    EditInitialData
}

// ── Wizard principal ──────────────────────────────────────────────────────────

export function PipelineCreationWizard({ onClose, onCreated, onSaved, editData }: Props) {
  const isEdit      = !!editData
  const tenantId    = useAuthStore((s) => s.tenant?.id)
  const queryClient = useQueryClient()

  // ── Estado inicial — pré-popula se modo edição ────────────────────────────
  const [step,   setStep]   = useState(1)
  const [name,   setName]   = useState(editData?.pipeline.name   ?? '')
  const [color,  setColor]  = useState(editData?.pipeline.color  ?? '#00e676')
  const [stages, setStages] = useState<StageRow[]>(() => {
    if (editData && editData.stages.length > 0) {
      return editData.stages.map((s) => ({
        id:      s.id,
        key:     s.id,   // key = id para stages existentes
        name:    s.name,
        color:   s.color,
        isStart: s.id === editData.pipeline.start_stage_id,
        isFinal: s.is_final,
      }))
    }
    // Padrão criação
    return [
      { key: uid(), name: 'Novo Lead',  color: '#40a0ff', isStart: true,  isFinal: false },
      { key: uid(), name: 'Em Contato', color: '#a78bfa', isStart: false, isFinal: false },
      { key: uid(), name: 'Agendado',   color: '#fbbf24', isStart: false, isFinal: false },
      { key: uid(), name: 'Fechado',    color: '#00e676', isStart: false, isFinal: true  },
    ]
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Validação por step
  const canAdvance = step === 1
    ? name.trim().length >= 2
    : stages.every((s) => s.name.trim().length > 0)

  function handleNext() {
    if (step < STEP_COUNT) { setStep((s) => s + 1); return }
    isEdit ? handleSave() : handleCreate()
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1)
  }

  // ── Modo criação ──────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!tenantId) return
    setSaving(true)
    setError(null)

    try {
      const pipeline = await createPipelineEmpty(tenantId, name.trim(), color)

      let startStageId: string | null = null
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i]
        const created = await createStage(tenantId, pipeline.id, s.name.trim(), s.color, i)
        if (s.isFinal) {
          const { supabase } = await import('@/lib/supabase')
          await supabase.from('pipeline_stages').update({ is_final: true }).eq('id', created.id)
        }
        if (s.isStart) startStageId = created.id
      }

      if (startStageId) {
        await updatePipeline(pipeline.id, { start_stage_id: startStageId })
      }

      invalidateAll(tenantId)
      onCreated?.(pipeline.id)
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao criar pipeline')
    } finally {
      setSaving(false)
    }
  }

  // ── Modo edição ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!tenantId || !editData) return
    setSaving(true)
    setError(null)

    const pipelineId = editData.pipeline.id

    try {
      // 1. Atualiza nome e cor da pipeline
      await updatePipeline(pipelineId, { name: name.trim(), color })

      // IDs das etapas que existiam antes
      const originalIds = new Set(editData.stages.map((s) => s.id))
      // IDs das etapas que ainda estão na lista (com id = existentes)
      const keptIds = new Set(stages.filter((s) => s.id).map((s) => s.id!))

      // 2. Remove etapas deletadas pelo usuário
      for (const origId of originalIds) {
        if (!keptIds.has(origId)) {
          await deleteStage(origId)
        }
      }

      // 3. Atualiza ou cria etapas na ordem final
      let startStageId: string | null = null

      for (let i = 0; i < stages.length; i++) {
        const s = stages[i]

        if (s.id) {
          // Etapa existente — atualiza
          await updateStage(s.id, {
            name:     s.name.trim(),
            color:    s.color,
            position: i,
            is_final: s.isFinal,
          })
          if (s.isStart) startStageId = s.id
        } else {
          // Nova etapa criada no wizard — insere
          const created = await createStage(tenantId, pipelineId, s.name.trim(), s.color, i)
          if (s.isFinal) {
            const { supabase } = await import('@/lib/supabase')
            await supabase.from('pipeline_stages').update({ is_final: true }).eq('id', created.id)
          }
          if (s.isStart) startStageId = created.id
        }
      }

      // 4. Atualiza start_stage_id da pipeline
      await updatePipeline(pipelineId, { start_stage_id: startStageId })

      invalidateAll(tenantId)
      onSaved?.()
      onClose()
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao salvar pipeline')
    } finally {
      setSaving(false)
    }
  }

  function invalidateAll(tid: string) {
    queryClient.invalidateQueries({ queryKey: ['pipelines',           tid] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-stages',     tid] })
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-stages', tid] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards',      tid] })
  }

  // Navegação por teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && e.ctrlKey) handleNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: '#0d0d0d' }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        {/* Indicador de passos */}
        <div className="flex items-center gap-2">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width:      i + 1 <= step ? 24 : 12,
                background: i + 1 <= step ? 'var(--tenant-primary)' : '#2a2a2a',
              }}
            />
          ))}
          <span className="text-xs ml-1" style={{ color: '#444' }}>
            {step}/{STEP_COUNT}
          </span>
          {isEdit && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
              Editando
            </span>
          )}
        </div>

        {/* Cancelar */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
        >
          Cancelar <X size={14} />
        </button>
      </div>

      {/* ── Conteúdo centralizado ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto py-8">
        {step === 1 && (
          <Step1Name
            name={name}    onName={setName}
            color={color}  onColor={setColor}
            isEdit={isEdit}
          />
        )}
        {step === 2 && (
          <Step2Stages stages={stages} onStages={setStages} />
        )}
      </div>

      {/* ── Erro ────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-center text-sm pb-2" style={{ color: '#ff4444' }}>{error}</p>
      )}

      {/* ── Navegação inferior ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 pb-8 shrink-0">
        {/* Voltar */}
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="h-12 w-12 rounded-full flex items-center justify-center transition-all disabled:opacity-0"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888' }}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Avançar / Salvar */}
        <button
          onClick={handleNext}
          disabled={!canAdvance || saving}
          className="h-12 w-12 rounded-full flex items-center justify-center transition-all disabled:opacity-30 text-black"
          style={{ background: canAdvance ? 'var(--tenant-primary)' : '#2a2a2a' }}
        >
          {saving ? (
            <div className="h-5 w-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
          ) : step === STEP_COUNT ? (
            <Check size={20} />
          ) : (
            <ChevronRight size={20} />
          )}
        </button>
      </div>
    </div>
  )
}
