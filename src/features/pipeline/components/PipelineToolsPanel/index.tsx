import { useState } from 'react'
import {
  X, Zap, Pencil, ArrowLeftRight, MessageCircle, Globe,
  Code2, Bot, Upload, Download, ScanSearch, Trash2,
  ChevronRight, Check,
} from 'lucide-react'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import type { Pipeline } from '@/services/pipelineManagement'

// ── Cores predefinidas ────────────────────────────────────────────────────────
const PRESET_COLORS = [
  '#00e676','#40a0ff','#a78bfa','#fbbf24',
  '#ec4899','#ff4444','#14B8A6','#f97316',
]

// ── Item de ferramenta ────────────────────────────────────────────────────────
interface ToolItem {
  icon:        React.ReactNode
  iconBg:      string
  label:       string
  description: string
  comingSoon?: boolean
  danger?:     boolean
  onClick?:    () => void
}

function ToolRow({ item }: { item: ToolItem }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={item.onClick}
      disabled={item.comingSoon || !item.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left disabled:cursor-default"
      style={{ background: hovered && !item.comingSoon ? '#1a1a1a' : 'transparent' }}
    >
      {/* Ícone */}
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: item.iconBg }}>
        {item.icon}
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium"
            style={{ color: item.danger ? '#ff4444' : '#e8e8e8' }}>
            {item.label}
          </span>
          {item.comingSoon && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: '#2a2a2a', color: '#555' }}>
              Em breve
            </span>
          )}
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: '#555' }}>
          {item.description}
        </p>
      </div>

      {/* Seta */}
      {!item.comingSoon && item.onClick && (
        <ChevronRight size={14} style={{ color: '#444', flexShrink: 0 }} />
      )}
    </button>
  )
}

// ── Seção ────────────────────────────────────────────────────────────────────
function Section({ title, items }: { title: string; items: ToolItem[] }) {
  return (
    <div>
      <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: '#444' }}>
        {title}
      </p>
      <div>
        {items.map((item, i) => <ToolRow key={i} item={item} />)}
      </div>
    </div>
  )
}

// ── Formulário inline de editar pipeline ────────────────────────────────────
function EditPipelineForm({
  pipeline,
  onClose,
}: {
  pipeline: Pipeline
  onClose:  () => void
}) {
  const { renamePipeline } = usePipelineManagement()
  const [name,  setName]  = useState(pipeline.name)
  const [color, setColor] = useState(pipeline.color)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await renamePipeline.mutateAsync({ id: pipeline.id, name: name.trim(), color })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-3"
      style={{ borderBottom: '1px solid #1e1e1e' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: '#888' }}>Editar Pipeline</span>
        <button onClick={onClose} className="transition-colors" style={{ color: '#444' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#888')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}>
          <X size={13} />
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        placeholder="Nome da pipeline"
        className="w-full h-8 rounded-lg px-2.5 text-sm focus:outline-none"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
        onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--tenant-primary)')}
        onBlur={(e) => (e.currentTarget.style.border = '1px solid #2a2a2a')}
        autoFocus
      />

      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)}
            className="h-5 w-5 rounded-full border-2 transition-transform"
            style={{
              backgroundColor: c,
              borderColor: color === c ? '#e8e8e8' : 'transparent',
              transform:   color === c ? 'scale(1.2)' : undefined,
            }} />
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 h-7 rounded-lg text-xs"
          style={{ border: '1px solid #2a2a2a', color: '#666' }}>
          Cancelar
        </button>
        <button onClick={handleSave} disabled={!name.trim() || saving}
          className="flex-1 h-7 rounded-lg text-xs text-black flex items-center justify-center gap-1 disabled:opacity-50"
          style={{ background: 'var(--tenant-primary)' }}>
          <Check size={11} />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ── Painel principal ──────────────────────────────────────────────────────────

interface PipelineToolsPanelProps {
  open:             boolean
  onClose:          () => void
  pipeline:         Pipeline | null
  stages?:          unknown[]
  onOpenAutomations:() => void
  onImport:         () => void
  onExport:         () => void
  onDelete:         () => void
}

export function PipelineToolsPanel({
  open, onClose, pipeline,
  onOpenAutomations, onImport, onExport, onDelete,
}: PipelineToolsPanelProps) {
  const [editingPipeline, setEditingPipeline] = useState(false)

  if (!open || !pipeline) return null

  const configItems: ToolItem[] = [
    {
      icon:        <Zap size={16} className="text-black" />,
      iconBg:      'var(--tenant-primary)',
      label:       'Automações e Gatilhos',
      description: 'WhatsApp, webhook e ações automáticas',
      onClick:     () => { onClose(); onOpenAutomations() },
    },
    {
      icon:        <Pencil size={16} style={{ color: '#e8e8e8' }} />,
      iconBg:      '#2a2a2a',
      label:       'Editar Pipeline',
      description: 'Nome, cor e configurações gerais',
      onClick:     () => setEditingPipeline(true),
    },
    {
      icon:        <ArrowLeftRight size={16} style={{ color: '#f97316' }} />,
      iconBg:      'rgba(249,115,22,0.12)',
      label:       'Regras de Movimentação',
      description: 'Restrições de troca de etapa',
      comingSoon:  true,
    },
  ]

  const integrationItems: ToolItem[] = [
    {
      icon:        <MessageCircle size={16} style={{ color: '#25D366' }} />,
      iconBg:      'rgba(37,211,102,0.12)',
      label:       'WhatsApp Não Oficial',
      description: 'Conecte um canal não oficial',
      onClick:     () => { onClose(); onOpenAutomations() },
    },
    {
      icon:        <Code2 size={16} style={{ color: '#a78bfa' }} />,
      iconBg:      'rgba(167,139,250,0.12)',
      label:       'API Oficial',
      description: 'API Oficial para alta escala',
      comingSoon:  true,
    },
    {
      icon:        <Globe size={16} style={{ color: '#40a0ff' }} />,
      iconBg:      'rgba(64,160,255,0.12)',
      label:       'Webhook',
      description: 'Receba dados de outros sistemas',
      onClick:     () => { onClose(); onOpenAutomations() },
    },
    {
      icon:        <Bot size={16} style={{ color: '#f97316' }} />,
      iconBg:      'rgba(249,115,22,0.12)',
      label:       'Agente de IA',
      description: 'Vincule um agente de IA',
      comingSoon:  true,
    },
  ]

  const leadsItems: ToolItem[] = [
    {
      icon:        <Upload size={16} style={{ color: '#e8e8e8' }} />,
      iconBg:      '#2a2a2a',
      label:       'Importar Leads',
      description: 'CSV ou Google Sheets',
      onClick:     () => { onClose(); onImport() },
    },
    {
      icon:        <Download size={16} style={{ color: '#e8e8e8' }} />,
      iconBg:      '#2a2a2a',
      label:       'Exportar Leads',
      description: 'Baixe os leads desta pipeline',
      onClick:     () => { onClose(); onExport() },
    },
    {
      icon:        <ScanSearch size={16} style={{ color: '#fbbf24' }} />,
      iconBg:      'rgba(251,191,36,0.12)',
      label:       'Procurar Duplicatas',
      description: 'Encontre leads duplicados',
      comingSoon:  true,
    },
  ]

  const dangerItems: ToolItem[] = [
    {
      icon:        <Trash2 size={16} style={{ color: '#ff4444' }} />,
      iconBg:      'rgba(255,68,68,0.12)',
      label:       'Excluir Pipeline',
      description: 'Remove a pipeline e todos os cards',
      danger:      true,
      onClick:     () => { onClose(); onDelete() },
    },
  ]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Painel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: 300,
          background: '#111',
          borderLeft: '1px solid #1e1e1e',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1e1e1e' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: '#e8e8e8' }}>
              Ferramentas da Pipeline
            </p>
            <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#555' }}>
              <span className="h-2 w-2 rounded-full inline-block shrink-0"
                style={{ background: pipeline.color }} />
              {pipeline.name}
            </p>
          </div>
          <button onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
            <X size={15} />
          </button>
        </div>

        {/* Formulário de edição inline (quando ativo) */}
        {editingPipeline && (
          <EditPipelineForm
            pipeline={pipeline}
            onClose={() => setEditingPipeline(false)}
          />
        )}

        {/* Lista de ferramentas */}
        <div className="flex-1 overflow-y-auto">
          <Section title="Configuração & Automação" items={configItems} />
          <div style={{ height: 1, background: '#1a1a1a', margin: '4px 0' }} />
          <Section title="Integrações Externas" items={integrationItems} />
          <div style={{ height: 1, background: '#1a1a1a', margin: '4px 0' }} />
          <Section title="Leads" items={leadsItems} />
          <div style={{ height: 1, background: '#1a1a1a', margin: '4px 0' }} />
          <Section title="Zona de Perigo" items={dangerItems} />
          <div className="h-8" />
        </div>
      </div>
    </>
  )
}
