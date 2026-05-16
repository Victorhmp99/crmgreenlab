import { useState, useEffect, useMemo } from 'react'
import { Download, FileSpreadsheet, CheckSquare, Square } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { fetchLeadFields } from '@/services/leadFieldDefinitions'
import type { LeadFieldDefinition } from '@/types'

interface ExportModalProps {
  open:    boolean
  onClose: () => void
}

// Campos padrão (colunas fixas do schema)
type StdFieldKey =
  | 'name' | 'company_name' | 'phone' | 'email'
  | 'status' | 'source' | 'source_campaign'
  | 'value' | 'channel'
  | 'notes' | 'tags'
  | 'assigned_to' | 'created_at' | 'updated_at'

const STD_FIELDS: { key: StdFieldKey; label: string; default: boolean }[] = [
  { key: 'name',            label: 'Nome',          default: true  },
  { key: 'company_name',    label: 'Empresa',       default: true  },
  { key: 'phone',           label: 'Telefone',      default: true  },
  { key: 'email',           label: 'E-mail',        default: true  },
  { key: 'status',          label: 'Status',        default: true  },
  { key: 'source',          label: 'Origem',        default: true  },
  { key: 'source_campaign', label: 'Campanha',      default: false },
  { key: 'value',           label: 'Valor (R$)',    default: true  },
  { key: 'channel',         label: 'Canal',         default: true  },
  { key: 'notes',           label: 'Observações',   default: false },
  { key: 'tags',            label: 'Tags',          default: false },
  { key: 'assigned_to',     label: 'Vendedor',      default: false },
  { key: 'created_at',      label: 'Criado em',     default: true  },
  { key: 'updated_at',      label: 'Atualizado em', default: false },
]

type Format = 'csv' | 'xlsx'

// Chave de um campo selecionado: padrão (`std:name`) ou customizado (`custom:<field_key>`)
type SelKey = string

export function ExportModal({ open, onClose }: ExportModalProps) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  const [customFields, setCustomFields] = useState<LeadFieldDefinition[]>([])
  const [loadingFields, setLoadingFields] = useState(false)

  const defaultSelected = useMemo(
    () => new Set<SelKey>(STD_FIELDS.filter((f) => f.default).map((f) => `std:${f.key}`)),
    [],
  )
  const [selected, setSelected] = useState<Set<SelKey>>(defaultSelected)
  const [format,   setFormat]   = useState<Format>('csv')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Carrega campos customizados ao abrir
  useEffect(() => {
    if (!open || !tenantId) return
    setLoadingFields(true)
    fetchLeadFields(tenantId)
      .then((fields) => {
        const active = fields.filter((f) => f.active)
        setCustomFields(active)
      })
      .catch(() => setCustomFields([]))
      .finally(() => setLoadingFields(false))
  }, [open, tenantId])

  function toggle(key: SelKey) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    const all = new Set<SelKey>()
    STD_FIELDS.forEach((f) => all.add(`std:${f.key}`))
    customFields.forEach((f) => all.add(`custom:${f.field_key}`))
    setSelected(all)
  }

  function clearAll() {
    setSelected(new Set())
  }

  async function handleExport() {
    if (!tenantId || selected.size === 0) return
    setBusy(true)
    setError(null)

    try {
      const [leadsRes, channelsRes, membershipsRes] = await Promise.all([
        supabase.from('leads').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('lead_channels').select('id, name').eq('tenant_id', tenantId),
        supabase.from('user_memberships').select('user_id, profile:user_profiles(full_name, email)').eq('tenant_id', tenantId),
      ])

      if (leadsRes.error) throw leadsRes.error

      const channelMap = new Map<string, string>()
      for (const c of channelsRes.data ?? []) channelMap.set(c.id, c.name)

      const userMap = new Map<string, string>()
      for (const m of (membershipsRes.data ?? []) as Array<{
        user_id: string
        profile: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null
      }>) {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
        if (p) userMap.set(m.user_id, p.full_name ?? p.email)
      }

      // Mapa custom field_key → definição (pra saber tipo e label)
      const customByKey = new Map<string, LeadFieldDefinition>()
      for (const f of customFields) customByKey.set(f.field_key, f)

      // Ordem: campos padrão selecionados primeiro, depois customizados
      const orderedHeaders: { selKey: SelKey; label: string }[] = []
      for (const f of STD_FIELDS) {
        if (selected.has(`std:${f.key}`)) orderedHeaders.push({ selKey: `std:${f.key}`, label: f.label })
      }
      for (const f of customFields) {
        if (selected.has(`custom:${f.field_key}`)) orderedHeaders.push({ selKey: `custom:${f.field_key}`, label: f.label })
      }

      const rows = (leadsRes.data ?? []).map((l) => {
        const row: Record<string, string | number | null> = {}
        for (const h of orderedHeaders) {
          if (h.selKey.startsWith('std:')) {
            const key = h.selKey.slice(4) as StdFieldKey
            row[h.label] = formatStdField(key, l, channelMap, userMap)
          } else {
            const fieldKey = h.selKey.slice(7) // remove 'custom:'
            const def = customByKey.get(fieldKey)
            row[h.label] = formatCustomField(l.custom_fields, fieldKey, def)
          }
        }
        return row
      })

      const filename = `leads-${new Date().toISOString().slice(0, 10)}.${format}`

      if (format === 'csv') {
        const csv = Papa.unparse(rows)
        // BOM pra Excel abrir com acentos certos
        downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename)
      } else {
        // XLSX real via SheetJS
        const sheet = XLSX.utils.json_to_sheet(rows)
        const book  = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(book, sheet, 'Leads')
        XLSX.writeFile(book, filename)
      }

      onClose()
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao exportar')
    } finally {
      setBusy(false)
    }
  }

  const totalAvailable = STD_FIELDS.length + customFields.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar Leads"
      description="Escolha os dados que deseja incluir na planilha"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={handleExport} loading={busy} disabled={selected.size === 0}>
            <Download size={14} /> Exportar {selected.size} coluna{selected.size !== 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Formato */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Formato
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'csv',  label: 'CSV (.csv)',    hint: 'Abre no Excel, Sheets, Numbers' },
              { id: 'xlsx', label: 'Excel (.xlsx)', hint: 'Planilha nativa do Excel' },
            ] as const).map((opt) => (
              <button key={opt.id} onClick={() => setFormat(opt.id)} type="button"
                className="rounded-lg px-3 py-2 text-left transition-all"
                style={{
                  background: format === opt.id ? 'rgba(0,230,118,0.08)' : '#1a1a1a',
                  border: format === opt.id ? '1px solid rgba(0,230,118,0.4)' : '1px solid #2a2a2a',
                }}>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} style={{ color: format === opt.id ? '#00e676' : '#666' }} />
                  <span className="text-sm font-medium" style={{ color: '#e8e8e8' }}>{opt.label}</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: '#666' }}>{opt.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Campos */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Colunas para exportar ({selected.size}/{totalAvailable})
            </label>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} type="button"
                className="text-xs underline transition-colors"
                style={{ color: '#666' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#00e676')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}>
                Selecionar tudo
              </button>
              <span style={{ color: '#333' }}>·</span>
              <button onClick={clearAll} type="button"
                className="text-xs underline transition-colors"
                style={{ color: '#666' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}>
                Limpar
              </button>
            </div>
          </div>

          <div className="rounded-xl p-3 max-h-80 overflow-y-auto flex flex-col gap-3"
            style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            {/* Padrão */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#555' }}>
                Dados do Lead
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {STD_FIELDS.map((f) => {
                  const selKey: SelKey = `std:${f.key}`
                  const checked = selected.has(selKey)
                  return (
                    <FieldCheckbox key={selKey} label={f.label} checked={checked}
                      onClick={() => toggle(selKey)} />
                  )
                })}
              </div>
            </div>

            {/* Customizados */}
            {loadingFields ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#666' }}>
                <Spinner size="sm" /> Carregando perguntas do formulário...
              </div>
            ) : customFields.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#555' }}>
                  Perguntas do Formulário ({customFields.length})
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {customFields.map((f) => {
                    const selKey: SelKey = `custom:${f.field_key}`
                    const checked = selected.has(selKey)
                    return (
                      <FieldCheckbox key={selKey} label={f.label} checked={checked}
                        onClick={() => toggle(selKey)} />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
            {error}
          </p>
        )}

        {busy && (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#aaa' }}>
            <Spinner size="sm" /> Gerando arquivo...
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Checkbox visual ─────────────────────────────────────────────────────────

function FieldCheckbox({ label, checked, onClick }: {
  label: string; checked: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} type="button"
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all min-w-0"
      style={{ background: checked ? 'rgba(0,230,118,0.06)' : 'transparent' }}
      onMouseEnter={(e) => { if (!checked) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = checked ? 'rgba(0,230,118,0.06)' : 'transparent' }}>
      {checked ? (
        <CheckSquare size={14} style={{ color: '#00e676' }} className="shrink-0" />
      ) : (
        <Square size={14} style={{ color: '#444' }} className="shrink-0" />
      )}
      <span className="text-sm truncate" style={{ color: checked ? '#e8e8e8' : '#888' }}>
        {label}
      </span>
    </button>
  )
}

// ── Format helpers ──────────────────────────────────────────────────────────

function formatStdField(
  key:         StdFieldKey,
  lead:        Record<string, unknown>,
  channelMap:  Map<string, string>,
  userMap:     Map<string, string>,
): string | number | null {
  switch (key) {
    case 'name':            return (lead.name as string) ?? ''
    case 'company_name':    return (lead.company_name as string | null) ?? ''
    case 'phone':           return (lead.phone as string | null) ?? ''
    case 'email':           return (lead.email as string | null) ?? ''
    case 'status':          return translateStatus(lead.status as string)
    case 'source':          return translateSource(lead.source as string)
    case 'source_campaign': return (lead.source_campaign as string | null) ?? ''
    case 'value':           return lead.value != null ? Number(lead.value) : ''
    case 'channel':         return lead.channel_id ? (channelMap.get(lead.channel_id as string) ?? '') : ''
    case 'notes':           return (lead.notes as string | null) ?? ''
    case 'tags':            return Array.isArray(lead.tags) ? (lead.tags as string[]).join(', ') : ''
    case 'assigned_to':     return lead.assigned_to ? (userMap.get(lead.assigned_to as string) ?? '') : ''
    case 'created_at':      return formatDate(lead.created_at as string)
    case 'updated_at':      return formatDate(lead.updated_at as string)
  }
}

function formatCustomField(
  customFields: unknown,
  fieldKey:     string,
  def?:         LeadFieldDefinition,
): string | number | null {
  if (!customFields || typeof customFields !== 'object') return ''
  const value = (customFields as Record<string, unknown>)[fieldKey]
  if (value == null || value === '') return ''

  // Formatação por tipo
  if (def) {
    if (def.field_type === 'boolean') return value ? 'Sim' : 'Não'
    if (def.field_type === 'number')  return typeof value === 'number' ? value : String(value)
  }
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
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

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
