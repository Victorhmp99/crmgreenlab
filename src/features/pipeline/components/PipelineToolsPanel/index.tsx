import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Zap, Pencil, ArrowLeftRight, MessageCircle, Globe,
  Code2, Bot, Upload, Download, ScanSearch, Trash2,
  ChevronRight, BarChart2, Target, Users,
  GitBranch, ListChecks,
} from 'lucide-react'
import type { Pipeline } from '@/services/pipelineManagement'
import { useFeatures, type FeatureKey } from '@/hooks/useFeatures'
import { usePermissions } from '@/hooks/usePermissions'

// ── Item de ferramenta ────────────────────────────────────────────────────────
interface ToolItem {
  icon:        React.ReactNode
  iconBg:      string
  label:       string
  description: string
  comingSoon?: boolean
  danger?:     boolean
  onClick?:    () => void
  feature?:    FeatureKey   // se definido, só aparece quando a empresa tem a função
  managerOnly?: boolean     // além da função: só gestor+ (vendedor nunca vê — ex.: dinheiro/relatórios)
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
  if (items.length === 0) return null   // some inteira se nada sobrou após o gate
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

// ── Painel principal ──────────────────────────────────────────────────────────

interface PipelineToolsPanelProps {
  open:             boolean
  onClose:          () => void
  pipeline:         Pipeline | null
  stages?:          unknown[]
  onOpenAutomations:() => void
  onEdit:           () => void
  onImport:         () => void
  onExport:         () => void
  onDelete:         () => void
}

export function PipelineToolsPanel({
  open, onClose, pipeline,
  onOpenAutomations, onEdit, onImport, onExport, onDelete,
}: PipelineToolsPanelProps) {
  const navigate = useNavigate()
  const { hasFeature } = useFeatures()
  const { isManager }  = usePermissions()

  if (!open || !pipeline) return null

  // Esconde a ferramenta se: a empresa não tem a função liberada, OU ela é
  // restrita a gestor+ e quem abriu é vendedor (o cargo sempre restringe —
  // ex.: Relatórios não aparece pro vendedor mesmo com o plano liberado).
  const gate = (items: ToolItem[]) => items.filter(
    (i) => (!i.feature || hasFeature(i.feature)) && (!i.managerOnly || isManager),
  )

  function goTo(path: string) {
    onClose()
    navigate(path)
  }

  const configItems: ToolItem[] = [
    {
      icon:        <Zap size={16} className="text-black" />,
      iconBg:      'var(--tenant-primary)',
      label:       'Automações e Gatilhos',
      description: 'WhatsApp, webhook e ações automáticas',
      onClick:     () => { onClose(); onOpenAutomations() },
      feature:     'automations',
    },
    {
      icon:        <Pencil size={16} style={{ color: '#e8e8e8' }} />,
      iconBg:      '#2a2a2a',
      label:       'Editar Pipeline',
      description: 'Nome, cor, etapas e configurações',
      onClick:     () => { onClose(); onEdit() },
    },
    {
      icon:        <GitBranch size={16} style={{ color: '#a78bfa' }} />,
      iconBg:      'rgba(167,139,250,0.12)',
      label:       'Etapas do Funil',
      description: 'Configure as etapas e métricas',
      onClick:     () => goTo('/settings?tab=funnel'),
    },
    {
      icon:        <ArrowLeftRight size={16} style={{ color: '#f97316' }} />,
      iconBg:      'rgba(249,115,22,0.12)',
      label:       'Regras de Movimentação',
      description: 'Restrições de troca de etapa',
      comingSoon:  true,
    },
  ]

  const analyticsItems: ToolItem[] = [
    {
      icon:        <BarChart2 size={16} style={{ color: '#40a0ff' }} />,
      iconBg:      'rgba(64,160,255,0.12)',
      label:       'Relatórios',
      description: 'Funil de conversão e análises',
      onClick:     () => goTo('/reports'),
      feature:     'relatorios',
      managerOnly: true,   // relatórios envolvem números — vendedor não vê
    },
    {
      icon:        <Target size={16} style={{ color: '#00e676' }} />,
      iconBg:      'rgba(0,230,118,0.12)',
      label:       'Metas da Equipe',
      description: 'Acompanhe metas de leads e vendas',
      onClick:     () => goTo('/goals'),
    },
    {
      icon:        <Users size={16} style={{ color: '#fbbf24' }} />,
      iconBg:      'rgba(251,191,36,0.12)',
      label:       'Leads desta Pipeline',
      description: 'Ver todos os leads no módulo',
      onClick:     () => goTo('/leads'),
    },
    {
      icon:        <ListChecks size={16} style={{ color: '#ec4899' }} />,
      iconBg:      'rgba(236,72,153,0.12)',
      label:       'Tarefas',
      description: 'Tarefas vinculadas a leads',
      onClick:     () => goTo('/tasks'),
    },
  ]

  const integrationItems: ToolItem[] = [
    {
      icon:        <MessageCircle size={16} style={{ color: '#25D366' }} />,
      iconBg:      'rgba(37,211,102,0.12)',
      label:       'WhatsApp (Evolution)',
      description: 'Conecte e configure o canal',
      onClick:     () => { onClose(); onOpenAutomations() },
      feature:     'automations',
    },
    {
      icon:        <Globe size={16} style={{ color: '#40a0ff' }} />,
      iconBg:      'rgba(64,160,255,0.12)',
      label:       'Webhook / Formulário',
      description: 'Receba leads de outros sistemas',
      onClick:     () => { onClose(); onOpenAutomations() },
      feature:     'automations',
    },
    {
      icon:        <Code2 size={16} style={{ color: '#a78bfa' }} />,
      iconBg:      'rgba(167,139,250,0.12)',
      label:       'API Oficial WhatsApp',
      description: 'Meta Business API — alta escala',
      comingSoon:  true,
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

        {/* Lista de ferramentas */}
        <div className="flex-1 overflow-y-auto">
          <Section title="Configuração & Automação" items={gate(configItems)} />
          <div style={{ height: 1, background: '#1a1a1a', margin: '4px 0' }} />
          <Section title="Analytics & Metas" items={gate(analyticsItems)} />
          <div style={{ height: 1, background: '#1a1a1a', margin: '4px 0' }} />
          <Section title="Integrações Externas" items={gate(integrationItems)} />
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
