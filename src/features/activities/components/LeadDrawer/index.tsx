import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Phone, Mail, Pencil, DollarSign, Megaphone, Tag as TagIcon,
  User, Calendar, ClipboardList, MessageSquare, FileText,
  ListChecks, FolderTree, Flag, GitBranch, Building2, FileSignature,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { LeadStatusBadge } from '@/features/leads/components/LeadStatusBadge'
import { LeadSourceBadge } from '@/features/leads/components/LeadSourceBadge'
import { TagPicker } from '@/features/leads/components/TagPicker'
import { useLeadTags } from '@/features/leads/hooks/useLeadTags'
import { LeadTimeline } from '../LeadTimeline'
import { RegistroRapidoLigacao } from '../RegistroRapidoLigacao'
import { LeadComments } from '../LeadComments'
import { ActivityForm } from '../ActivityForm'
import { LeadContractTab } from '../LeadContractTab'
import { TaskList } from '@/features/tasks/components/TaskList'
import { formatPhone, formatCurrency, formatDateTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useFeatures } from '@/hooks/useFeatures'
import { fetchLeadFields } from '@/services/leadFieldDefinitions'
import { fetchLeadComments } from '@/services/leadComments'
import { useQuery } from '@tanstack/react-query'
import type { Lead, LeadFieldDefinition } from '@/types'

interface LeadDrawerProps {
  lead:          Lead | null
  onClose:       () => void
  onEdit:        (lead: Lead) => void
  pipelineName?: string
  initialTab?:   'data' | 'activities' | 'organization' | 'contract'
}

type Tab = 'data' | 'activities' | 'organization' | 'contract'

export function LeadDrawer({ lead, onClose, onEdit, initialTab }: LeadDrawerProps) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { isManager, isSuperAdmin } = usePermissions()
  const { hasFeature } = useFeatures()
  // Precisa do cargo E da função "financeiro" liberada no plano da empresa.
  // Sem a função, o valor do lead continua editável pelo "Editar lead" —
  // só contratos/produtos é que ficam de fora.
  const canSeeContract = (isManager || isSuperAdmin) && hasFeature('financeiro')
  const [visible,  setVisible]  = useState(false)
  const [tab,      setTab]      = useState<Tab>(initialTab ?? 'data')
  const [showActivityForm, setShowActivityForm] = useState(false)

  // Metadados que precisamos pra mostrar tudo
  const [channelName, setChannelName] = useState<string | null>(null)
  const [channelColor, setChannelColor] = useState<string | null>(null)
  const [assignedName, setAssignedName] = useState<string | null>(null)
  const [customDefs, setCustomDefs] = useState<LeadFieldDefinition[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)

  // Tags + comentários (pra mostrar contagens e dados na aba "Dados")
  const { data: leadTags = [] } = useLeadTags(lead?.id ?? null)
  const { data: comments = [] } = useQuery({
    queryKey: ['lead-comments', lead?.id],
    queryFn:  () => fetchLeadComments(lead!.id),
    enabled:  !!lead,
    staleTime: 1000 * 30,
  })

  useEffect(() => {
    if (lead) requestAnimationFrame(() => setVisible(true))
    else setVisible(false)
  }, [lead])

  useEffect(() => {
    if (!lead) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lead, onClose])

  // Reseta para "Dados" sempre que abre lead diferente
  // Se pedirem a aba de contrato sem a função liberada, cai em "Dados"
  // em vez de abrir num painel vazio.
  useEffect(() => {
    if (!lead) return
    const wanted = initialTab ?? 'data'
    setTab(wanted === 'contract' && !canSeeContract ? 'data' : wanted)
  }, [lead?.id])

  useEffect(() => {
    if (!lead || !tenantId) return
    setLoadingMeta(true)
    setChannelName(null); setChannelColor(null); setAssignedName(null)

    const tasks: Array<Promise<unknown>> = []
    tasks.push(Promise.resolve(fetchLeadFields(tenantId)).then(setCustomDefs))

    if (lead.channel_id) {
      const channelId = lead.channel_id
      tasks.push(
        Promise.resolve(
          supabase.from('lead_channels').select('name, color').eq('id', channelId).maybeSingle(),
        ).then(({ data }) => {
          if (data) {
            setChannelName((data as { name: string }).name)
            setChannelColor((data as { color: string }).color)
          }
        }),
      )
    }
    if (lead.assigned_to) {
      const userId = lead.assigned_to
      tasks.push(
        Promise.resolve(
          supabase.from('user_profiles').select('full_name, email').eq('user_id', userId).maybeSingle(),
        ).then(({ data }) => {
          const p = data as { full_name: string | null; email: string } | null
          if (p) setAssignedName(p.full_name ?? p.email)
        }),
      )
    }
    Promise.all(tasks).finally(() => setLoadingMeta(false))
  }, [lead, tenantId])

  if (!lead) return null

  // Mostra TODOS os campos customizados ativos (preenchidos ou vazios)
  const allCustom = customDefs
    .filter((def) => def.active)
    .map((def) => ({
      def,
      value: (lead.custom_fields as Record<string, unknown> | undefined)?.[def.field_key],
    }))

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className={`absolute inset-0 backdrop-blur-[2px] transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      <div
        className={`relative z-10 w-full max-w-md flex flex-col h-full transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: '#0f0f0f', borderLeft: '1px solid #1e1e1e' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-base font-semibold truncate" style={{ color: '#e8e8e8' }}>{lead.name}</h2>
            {lead.company_name && (
              <p className="text-xs flex items-center gap-1 mt-0.5 truncate" style={{ color: '#888' }}>
                <Building2 size={11} style={{ color: '#555' }} />
                {lead.company_name}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <LeadStatusBadge status={lead.status} />
              <LeadSourceBadge source={lead.source} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(lead)} title="Editar lead"
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#00e676'; e.currentTarget.style.background = 'rgba(0,230,118,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
              <Pencil size={15} />
            </button>
            <button onClick={onClose} title="Fechar"
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = '#1e1e1e' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Datas — cadastro + última atualização */}
        <div className="flex items-center gap-4 px-5 py-2 shrink-0 tabular-nums"
          style={{ borderBottom: '1px solid #1a1a1a', background: '#111' }}>
          <div className="flex items-center gap-1.5 text-[11px]">
            <Calendar size={11} style={{ color: '#555' }} />
            <span style={{ color: '#555' }}>Cadastro:</span>
            <span style={{ color: '#888' }}>{formatDateTime(lead.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span style={{ color: '#555' }}>Atualiz.:</span>
            <span style={{ color: '#888' }}>{formatDateTime(lead.updated_at)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-1 rounded-xl p-1"
            style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
            <TabBtn active={tab === 'data'}         onClick={() => setTab('data')}
              icon={<FileText size={13} />}      label="Dados" />
            <TabBtn active={tab === 'activities'}   onClick={() => setTab('activities')}
              icon={<ListChecks size={13} />}    label="Movimentações" />
            <TabBtn active={tab === 'organization'} onClick={() => setTab('organization')}
              icon={<FolderTree size={13} />}    label="Organização" />
            {canSeeContract && (
              <TabBtn active={tab === 'contract'} onClick={() => setTab('contract')}
                icon={<FileSignature size={13} />} label="Financeiro" />
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'data' && (
            <div className="flex flex-col gap-4">
              {/* Bloco 1: TODOS os campos preenchidos */}
              <div className="flex flex-col gap-2">
                <Field icon={<Building2 size={13} />} label="Empresa">
                  {lead.company_name
                    ? <span style={{ color: '#e8e8e8' }}>{lead.company_name}</span>
                    : <Empty />}
                </Field>

                <Field icon={<Phone size={13} />} label="Telefone">
                  {lead.phone ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <a href={`tel:${lead.phone}`} style={{ color: '#e8e8e8' }}>{formatPhone(lead.phone)}</a>
                        <a href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium flex items-center gap-1"
                          style={{ color: '#00e676' }}>
                          <span>●</span> WhatsApp
                        </a>
                      </div>
                      {/* Fica colado no telefone de propósito: é onde a pessoa
                          está olhando no segundo seguinte à ligação. */}
                      <RegistroRapidoLigacao leadId={lead.id} />
                    </div>
                  ) : <Empty />}
                </Field>

                <Field icon={<Mail size={13} />} label="E-mail">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="truncate" style={{ color: '#e8e8e8' }}>{lead.email}</a>
                  ) : <Empty />}
                </Field>

                <Field icon={<Flag size={13} />} label="Status">
                  <span style={{ color: '#e8e8e8' }}>{translateStatus(lead.status)}</span>
                </Field>

                <Field icon={<GitBranch size={13} />} label="Origem">
                  <span style={{ color: '#e8e8e8' }}>{translateSource(lead.source)}</span>
                </Field>

                <Field icon={<TagIcon size={13} />} label="Canal">
                  {channelName ? (
                    <div className="flex items-center gap-1.5">
                      {channelColor && <span className="h-2 w-2 rounded-full" style={{ background: channelColor }} />}
                      <span style={{ color: '#e8e8e8' }}>{channelName}</span>
                    </div>
                  ) : <span style={{ color: '#666' }}>Sem categoria</span>}
                </Field>

                <Field icon={<Megaphone size={13} />} label="Campanha">
                  {lead.source_campaign
                    ? <span style={{ color: '#e8e8e8' }}>{lead.source_campaign}</span>
                    : <Empty />}
                </Field>

                <Field icon={<DollarSign size={13} />} label="Valor">
                  {lead.value != null && Number(lead.value) > 0
                    ? <span className="font-semibold tabular-nums" style={{ color: '#00e676' }}>{formatCurrency(Number(lead.value))}</span>
                    : <Empty />}
                </Field>

                <Field icon={<User size={13} />} label="Vendedor">
                  {assignedName
                    ? <span style={{ color: '#e8e8e8' }}>{assignedName}</span>
                    : <span style={{ color: '#666' }}>Não atribuído</span>}
                </Field>

                <Field icon={<Calendar size={13} />} label="Criado em">
                  <span className="text-xs tabular-nums" style={{ color: '#aaa' }}>{formatDateTime(lead.created_at)}</span>
                </Field>
              </div>

              {/* Tags (readonly) */}
              {leadTags.length > 0 && (
                <div>
                  <SubLabel icon={<TagIcon size={11} />}>Tags</SubLabel>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {leadTags.map((tag) => (
                      <span key={tag.id}
                        className="text-xs rounded-full px-2.5 py-0.5"
                        style={{
                          background: `${tag.color}22`,
                          color: tag.color,
                          border: `1px solid ${tag.color}55`,
                        }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações */}
              {lead.notes && (
                <div>
                  <SubLabel>Observações</SubLabel>
                  <div className="rounded-xl px-3 py-2.5 text-sm leading-relaxed mt-1.5"
                    style={{ background: '#141414', border: '1px solid #1e1e1e', color: '#888' }}>
                    {lead.notes}
                  </div>
                </div>
              )}

              {/* Perguntas do formulário (todas, mesmo as vazias) */}
              {(loadingMeta || allCustom.length > 0) && (
                <div>
                  <SubLabel icon={<ClipboardList size={11} />}>Perguntas do Formulário</SubLabel>
                  {loadingMeta && allCustom.length === 0 ? (
                    <div className="flex justify-center py-3"><Spinner size="sm" /></div>
                  ) : (
                    <div className="flex flex-col gap-2 mt-1.5">
                      {allCustom.map(({ def, value }) => {
                        const hasValue = value != null && value !== ''
                        return (
                          <div key={def.id}>
                            <span className="text-[11px]" style={{ color: '#555' }}>
                              {def.label}{def.required ? ' *' : ''}
                            </span>
                            <p className="text-sm" style={{ color: hasValue ? '#e8e8e8' : '#555', fontStyle: hasValue ? undefined : 'italic' }}>
                              {hasValue ? formatCustomValue(value, def) : '— não preenchido —'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Comentários (readonly) */}
              {comments.length > 0 && (
                <div>
                  <SubLabel icon={<MessageSquare size={11} />}>Últimos comentários ({comments.length})</SubLabel>
                  <div className="flex flex-col gap-2 mt-1.5">
                    {comments.slice(0, 3).map((c) => (
                      <div key={c.id} className="rounded-lg px-3 py-2"
                        style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
                        <p className="text-xs font-medium" style={{ color: '#aaa' }}>
                          {c.user_name ?? c.user_email?.split('@')[0] ?? 'Usuário'}
                        </p>
                        <p className="text-sm mt-0.5" style={{ color: '#888' }}>{c.content}</p>
                      </div>
                    ))}
                    {comments.length > 3 && (
                      <button onClick={() => setTab('organization')}
                        className="text-xs text-left underline transition-colors"
                        style={{ color: '#666' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#00e676')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}>
                        Ver todos os {comments.length} comentários em Organização →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Hint sobre edição */}
              <p className="text-[11px] text-center mt-2 px-3 py-2 rounded-lg"
                style={{ color: '#555', background: '#0f0f0f', border: '1px dashed #2a2a2a' }}>
                Para editar os dados do lead clique no <Pencil size={11} className="inline mx-1" style={{ color: '#888' }} /> no topo.
                Tags, comentários e tarefas em <strong>Organização</strong>.
              </p>
            </div>
          )}

          {tab === 'activities' && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <button onClick={() => setShowActivityForm(true)}
                  className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                  style={{ background: 'var(--tenant-primary)', color: '#000' }}>
                  <ListChecks size={12} /> Registrar atividade
                </button>
              </div>
              <LeadTimeline leadId={lead.id} onRegister={() => setShowActivityForm(true)} />
            </div>
          )}

          {tab === 'organization' && (
            <div className="flex flex-col gap-5">
              {/* Tags editáveis */}
              <div>
                <SubLabel icon={<TagIcon size={11} />}>Tags</SubLabel>
                <div className="mt-1.5">
                  <TagPicker leadId={lead.id} />
                </div>
              </div>

              {/* Tarefas */}
              <div>
                <TaskList leadId={lead.id} />
              </div>

              {/* Comentários */}
              <div>
                <SubLabel icon={<MessageSquare size={11} />}>Comentários</SubLabel>
                <div className="mt-1.5">
                  <LeadComments leadId={lead.id} />
                </div>
              </div>
            </div>
          )}

          {tab === 'contract' && canSeeContract && (
            <LeadContractTab lead={lead} />
          )}
        </div>
      </div>

      <ActivityForm
        open={showActivityForm}
        onClose={() => setShowActivityForm(false)}
        presetLeadId={lead.id}
        presetLeadName={lead.name}
      />
    </div>,
    document.body,
  )
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[16px_90px_1fr] gap-2 items-center py-1">
      <span style={{ color: '#555' }}>{icon}</span>
      <span className="text-xs" style={{ color: '#666' }}>{label}</span>
      <div className="text-sm min-w-0 truncate">{children}</div>
    </div>
  )
}

function Empty() {
  return <span style={{ color: '#555', fontStyle: 'italic' }}>— vazio —</span>
}

function translateStatus(s: string): string {
  switch (s) {
    case 'active':    return 'Ativo'
    case 'converted': return 'Convertido'
    case 'lost':      return 'Perdido'
    case 'archived':  return 'Arquivado'
    default:          return s
  }
}

function translateSource(s: string): string {
  switch (s) {
    case 'manual':    return 'Manual'
    case 'import':    return 'Importado'
    case 'meta_ads':  return 'Meta Ads'
    case 'google':    return 'Google'
    case 'referral':  return 'Indicação'
    case 'other':     return 'Outro'
    default:          return s
  }
}

function SubLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
      style={{ color: '#555' }}>
      {icon}
      {children}
    </p>
  )
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all"
      style={
        active
          ? { background: '#1e1e1e', color: 'var(--text)', border: '1px solid #2a2a2a' }
          : { color: '#666' }
      }>
      {icon}
      {label}
    </button>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCustomValue(value: unknown, def: LeadFieldDefinition): string {
  if (value == null || value === '') return '—'
  if (def.field_type === 'boolean') return value ? 'Sim' : 'Não'
  if (def.field_type === 'number')  return String(value)
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

