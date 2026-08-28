import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Users, RefreshCw, ShieldCheck, ShieldOff,
  TrendingUp, Clock, UserX, UserCheck, Star, StarOff,
  UserPlus, ChevronDown, Trash2, Link2, Copy, CheckCircle, Save, Pencil, KeyRound,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { setUserCompanyLimit } from '@/services/users'
import { Button }  from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal }   from '@/components/ui/Modal'
import { Input }   from '@/components/ui/Input'
import { Select }  from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { createInvite } from '@/services/users'
import { SignupLinkModal } from '@/features/users/components/SignupLinkModal'
import { SendNotificationModal } from '@/features/notifications/components/SendNotificationModal'
import { Send, ArrowUpDown } from 'lucide-react'
import { FEATURE_CATALOG, PLAN_CATALOG, sameFeatureSet } from '@/hooks/useFeatures'
import type { UserRole } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PlatformUser {
  membership_id:          string
  user_id:                string
  tenant_id:              string
  tenant_name:            string
  email:                  string
  full_name:              string | null
  role:                   string
  account_status:         string
  is_super_admin:         boolean
  super_admin_type:       string | null
  joined_at:              string
  status_changed_at:      string | null
  max_companies_override: number | null
  company_count:          number
}

interface TenantStat {
  tenant_id:         string
  tenant_name:       string
  tenant_slug:       string
  tenant_plan:       string
  tenant_active:     boolean
  tenant_created_at: string
  user_count:        number
  lead_count:        number
  tenant_features:   string[]
  /** Dono derivado: o admin mais antigo da empresa (não existe coluna de criador). */
  owner_name:        string | null
  owner_email:       string | null
}

// ── Serviços ──────────────────────────────────────────────────────────────────

async function fetchPlatformUsers(): Promise<PlatformUser[]> {
  const { data, error } = await supabase.rpc('get_platform_users')
  if (error) throw error
  return (data ?? []) as PlatformUser[]
}

async function fetchPlatformStats(): Promise<TenantStat[]> {
  const { data, error } = await supabase.rpc('get_platform_stats')
  if (error) throw error
  return (data ?? []) as TenantStat[]
}

async function fetchAllTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}


// ── Ordenação ────────────────────────────────────────────────────────────────

/** Nome A-Z, ou por data de entrada nos dois sentidos. */
type Ordem = 'nome' | 'antigos' | 'recentes'

const ORDENS: Array<{ valor: Ordem; rotulo: string }> = [
  { valor: 'nome',     rotulo: 'A–Z' },
  { valor: 'antigos',  rotulo: 'Mais antigos' },
  { valor: 'recentes', rotulo: 'Mais recentes' },
]

function SortControl({ ordem, onChange }: { ordem: Ordem; onChange: (o: Ordem) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <ArrowUpDown size={13} style={{ color: '#444' }} />
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #232323' }}>
        {ORDENS.map((o) => (
          <button
            key={o.valor}
            onClick={() => onChange(o.valor)}
            className="text-[11px] px-2.5 py-1 transition-colors"
            style={{
              background: ordem === o.valor ? 'rgba(0,230,118,0.1)' : 'transparent',
              color:      ordem === o.valor ? '#00e676' : '#666',
            }}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Ordena sem alterar o array original — a lista vem de cache do React Query e
 * `sort` in-place mutaria o dado compartilhado.
 *
 * `localeCompare` com pt-BR pra "Ângela" não cair depois de "Zuleica", que é o
 * que acontece comparando por código de caractere.
 */
function ordenar<T>(itens: T[], ordem: Ordem, nome: (i: T) => string, data: (i: T) => string): T[] {
  return [...itens].sort((a, b) => {
    if (ordem === 'nome') return nome(a).localeCompare(nome(b), 'pt-BR', { sensitivity: 'base' })
    const da = new Date(data(a)).getTime()
    const db = new Date(data(b)).getTime()
    return ordem === 'antigos' ? da - db : db - da
  })
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MetricCard({ label, value, color, icon: Icon }: {
  label: string; value: number | string; color: string; icon: React.ElementType
}) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color }}>
        <Icon size={18} style={{ color: '#000' }} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{value}</p>
        <p className="text-xs" style={{ color: '#555' }}>{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active:  { label: 'Ativo',     color: '#00e676', bg: 'rgba(0,230,118,0.1)'  },
    pending: { label: 'Pendente',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    blocked: { label: 'Bloqueado', color: '#ff4444', bg: 'rgba(255,68,68,0.1)'  },
  }
  const s = map[status] ?? map.pending
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1"
      style={{ background: s.bg, color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  )
}

// ── Modal de Convite da Plataforma ────────────────────────────────────────────

function PlatformInviteModal({ open, onClose, presetTenantId, presetTenantName }: {
  open: boolean; onClose: () => void
  presetTenantId?: string; presetTenantName?: string
}) {
  const currentUser = useAuthStore((s) => s.user)
  const [email, setEmail]         = useState('')
  const [tenantId, setTenantId]   = useState('')
  const [role, setRole]           = useState<UserRole>('seller')
  const [sending, setSending]     = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [err, setErr]             = useState<string | null>(null)

  const hasPreset = !!presetTenantId
  const effectiveTenantId = hasPreset ? presetTenantId : tenantId

  const { data: tenants = [] } = useQuery({
    queryKey: ['all-tenants'],
    queryFn:  fetchAllTenants,
    enabled:  open && !hasPreset,
  })

  async function handleSend() {
    if (!email || !effectiveTenantId || !currentUser?.id) return
    setSending(true)
    setErr(null)
    try {
      const inv = await createInvite(effectiveTenantId!, email, role, currentUser.id)
      const url = `${window.location.origin}${window.location.pathname}#/convite/${inv.token}`
      setInviteUrl(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar convite.')
    } finally {
      setSending(false)
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {/* silencioso */}
  }

  function handleClose() {
    setEmail(''); setTenantId(''); setRole('seller')
    setInviteUrl(null); setCopied(false); setErr(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Convidar usuário" size="sm"
      footer={
        inviteUrl ? (
          <Button onClick={handleClose}>Fechar</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={sending}>Cancelar</Button>
            <Button onClick={handleSend} loading={sending}
              disabled={!email || !effectiveTenantId}>
              Gerar link
            </Button>
          </>
        )
      }
    >
      {inviteUrl ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserCheck size={20} style={{ color: '#00e676' }} />
            <p className="text-sm" style={{ color: '#e8e8e8' }}>
              Convite gerado para <strong>{email}</strong>
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Link de convite (válido 7 dias)
            </label>
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-lg px-3 py-2 text-xs font-mono break-all"
                style={{ background: '#111', border: '1px solid #1a1a1a', color: '#aaa' }}>
                {inviteUrl}
              </span>
              <button onClick={handleCopy}
                className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all"
                style={{
                  background: copied ? 'rgba(0,230,118,0.08)' : '#1a1a1a',
                  border:     copied ? '1px solid rgba(0,230,118,0.3)' : '1px solid #2a2a2a',
                  color:      copied ? '#00e676' : '#888',
                }}>
                {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <p className="text-xs rounded-lg px-3 py-2"
            style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}>
            Envie este link para <strong style={{ color: '#888' }}>{email}</strong> via WhatsApp ou email.
            A pessoa clica, cria a senha e entra direto na empresa selecionada.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input
            label="E-mail do usuário"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {hasPreset ? (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: '#888' }}>Empresa</label>
              <div className="h-10 rounded-lg px-3 flex items-center text-sm"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}>
                {presetTenantName}
              </div>
            </div>
          ) : (
            <Select
              label="Empresa (tenant)"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              options={[
                { value: '', label: 'Selecione a empresa...' },
                ...tenants.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          )}
          <Select
            label="Nível de acesso"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={[
              { value: 'seller',  label: 'Vendedor' },
              { value: 'manager', label: 'Gestor'   },
              { value: 'admin',   label: 'Admin'    },
            ]}
          />
          {err && (
            <p className="text-xs rounded-lg px-3 py-2"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
              {err}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

// SignupLinkModal foi movido para src/features/users/components/SignupLinkModal (com role + tenant picker)

// ── Célula de limite de empresas (plataforma) ─────────────────────────────────

function PlatformLimitCell({
  membershipId, current, onSaved,
}: { membershipId: string; current: number | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(current != null ? String(current) : '')
  const [saving, setSaving]   = useState(false)

  async function save() {
    const parsed = value.trim() === '' ? null : parseInt(value, 10)
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) { setEditing(false); return }
    setSaving(true)
    try {
      await setUserCompanyLimit(membershipId, parsed)
      onSaved()
      setEditing(false)
    } finally { setSaving(false) }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number" min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus placeholder="∞"
          className="h-7 w-16 rounded px-2 text-xs focus:outline-none"
          style={{ background: '#1a1a1a', border: '1px solid #a78bfa', color: '#e8e8e8' }}
        />
        <button onClick={save} disabled={saving}
          className="text-xs rounded px-2 py-1"
          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
          {saving ? '...' : <Save size={11} />}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs" style={{ color: '#555' }}>✕</button>
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)}
      title="Clique para definir limite"
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all"
      style={{ background: 'transparent', border: '1px solid transparent', color: current != null ? '#e8e8e8' : '#444' }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.border = '1px solid #2a2a2a'
        ;(e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent'
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <Building2 size={11} style={{ color: current != null ? '#a78bfa' : '#444' }} />
      {current != null ? current : '∞'}
    </button>
  )
}

// ── Aba Usuários ──────────────────────────────────────────────────────────────

function UsersTab({ isMaster }: { isMaster: boolean }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [statusFilter, setStatusFilter]       = useState<string>('all')
  const [ordem,        setOrdem]              = useState<Ordem>('recentes')
  const [showInvite, setShowInvite]           = useState(false)
  const [showSignupLink, setShowSignupLink]   = useState(false)
  const [confirmRemove, setConfirmRemove]     = useState<PlatformUser | null>(null)

  // Envia um e-mail com link pra pessoa criar uma nova senha (mesmo fluxo do
  // "Esqueci a senha"). Senha nunca é exposta — só um link de redefinição.
  async function handleResetPassword(u: PlatformUser) {
    const ok = await confirm({
      title: 'Redefinir senha',
      message: `Enviar um link de redefinição de senha para ${u.email}? A pessoa vai receber um e-mail para criar uma nova senha.`,
      confirmLabel: 'Enviar link',
    })
    if (!ok) return
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
    })
    await confirm({
      variant: 'alert',
      title: error ? 'Não foi possível enviar' : 'Link enviado',
      message: error
        ? `Erro ao enviar: ${error.message}`
        : `Enviamos um e-mail para ${u.email} com o link para redefinir a senha. Se a pessoa não achar, avise para conferir a caixa de spam ou lixo eletrônico.`,
    })
  }

  // Lista de tenants pro picker do SignupLinkModal (super admin)
  const { data: allTenants = [] } = useQuery({
    queryKey: ['all-tenants-signup'],
    queryFn:  fetchAllTenants,
  })

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['platform-users'],
    queryFn:  fetchPlatformUsers,
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc('set_account_status', { p_membership_id: id, p_status: status })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
  })

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.rpc('set_platform_user_role', { p_membership_id: id, p_role: role })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
  })

  const grantAuxMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('grant_super_admin_auxiliary', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
  })

  const revokeAuxMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('revoke_super_admin', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Hard delete: remove de TODAS as tabelas + auth.users
      const { error } = await supabase.rpc('delete_user_completely', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      setConfirmRemove(null)
    },
  })

  const filtrados = statusFilter === 'all'
    ? users
    : users.filter((u) => u.account_status === statusFilter)

  const filtered = ordenar(
    filtrados, ordem,
    (u) => u.full_name || u.email,
    (u) => u.joined_at,
  )

  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const newToday = users.filter((u) => new Date(u.joined_at) >= today).length

  return (
    <div className="flex flex-col gap-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Total"     value={users.length}                                                  color="rgba(64,160,255,0.2)"   icon={Users}      />
        <MetricCard label="Pendentes" value={users.filter((u) => u.account_status === 'pending').length}  color="rgba(251,191,36,0.2)"   icon={Clock}      />
        <MetricCard label="Ativos"    value={users.filter((u) => u.account_status === 'active').length}   color="rgba(0,230,118,0.2)"    icon={UserCheck}  />
        <MetricCard label="Bloqueados"value={users.filter((u) => u.account_status === 'blocked').length}  color="rgba(255,68,68,0.2)"    icon={UserX}      />
        <MetricCard label="Novos hoje"value={newToday}                                                      color="rgba(167,139,250,0.2)"  icon={TrendingUp} />
      </div>

      {/* Filtros + ação */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'active', 'blocked'] as const).map((s) => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: statusFilter === s ? 'rgba(0,230,118,0.1)' : '#141414',
                border:     statusFilter === s ? '1px solid rgba(0,230,118,0.3)' : '1px solid #1e1e1e',
                color:      statusFilter === s ? '#00e676' : '#555',
              }}>
              {{ all: 'Todos', pending: 'Pendentes', active: 'Ativos', blocked: 'Bloqueados' }[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <SortControl ordem={ordem} onChange={setOrdem} />
          <Button size="sm" variant="ghost" onClick={() => setShowSignupLink(true)}>
            <Link2 size={14} />
            Link de cadastro
          </Button>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus size={14} />
            Convidar
          </Button>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="rounded-xl p-6 flex flex-col gap-2"
          style={{ background: '#141414', border: '1px solid rgba(255,68,68,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#ff4444' }}>
            Erro ao carregar usuários — execute o SQL abaixo no Supabase
          </p>
          <p className="text-xs font-mono rounded px-2 py-1 break-all"
            style={{ background: '#0d0d0d', color: '#ff6666' }}>
            {(error as Error).message}
          </p>
          <p className="text-xs mt-1" style={{ color: '#555' }}>
            Copie o arquivo <strong style={{ color: '#888' }}>supabase/add_account_status.sql</strong> e execute no SQL Editor do Supabase.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-16 text-center"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <Users size={28} className="mx-auto mb-3" style={{ color: '#333' }} />
          <p className="text-sm" style={{ color: '#555' }}>Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
                {['Usuário', 'Empresa', 'Cargo', 'Status', 'Limite empresas', 'Super Admin', 'Ações'].map((h, i) => (
                  <th key={h}
                    className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${i >= 3 ? 'text-center' : 'text-left'}`}
                    style={{ color: '#444' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => {
                // Agrupa visualmente: só mostra avatar/email na primeira membership do usuário
                const isFirstOfUser = idx === 0 || filtered[idx - 1].user_id !== u.user_id
                return (
                <tr key={u.membership_id}
                  style={{ borderBottom: '1px solid #191919', background: isFirstOfUser ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isFirstOfUser ? 'transparent' : 'rgba(255,255,255,0.01)')}>

                  {/* Usuário — só mostra na primeira linha do usuário */}
                  <td className="px-4 py-3">
                    {isFirstOfUser ? (
                      <>
                        <p className="font-medium text-xs flex items-center gap-1.5" style={{ color: '#e8e8e8' }}>
                          {u.full_name ?? u.email}
                          {u.company_count > 1 && (
                            <span className="text-[9px] rounded-full px-1.5 py-0.5"
                              style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676' }}>
                              {u.company_count} empresas
                            </span>
                          )}
                        </p>
                        {u.full_name && <p className="text-[11px] mt-0.5" style={{ color: '#444' }}>{u.email}</p>}
                        <p className="text-[10px] mt-0.5" style={{ color: '#333' }}>desde {formatDate(u.joined_at)}</p>
                      </>
                    ) : (
                      <p className="text-[10px] pl-3" style={{ color: '#333', borderLeft: '2px solid #222' }}>
                        ↳ mesma conta
                      </p>
                    )}
                  </td>

                  {/* Empresa */}
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: '#888' }}>{u.tenant_name}</span>
                  </td>

                  {/* Cargo */}
                  <td className="px-4 py-3">
                    <RoleDropdown
                      currentRole={u.role}
                      onChange={(role) => roleMutation.mutate({ id: u.membership_id, role })}
                      disabled={roleMutation.isPending}
                    />
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={u.account_status} />
                  </td>

                  {/* Limite de empresas */}
                  <td className="px-4 py-3 text-center">
                    <PlatformLimitCell
                      membershipId={u.membership_id}
                      current={u.max_companies_override}
                      onSaved={() => queryClient.invalidateQueries({ queryKey: ['platform-users'] })}
                    />
                  </td>

                  {/* Super Admin */}
                  <td className="px-4 py-3 text-center">
                    {u.is_super_admin ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: u.super_admin_type === 'master' ? '#fbbf24' : '#a78bfa' }}>
                        <Star size={12} />
                        {u.super_admin_type === 'master' ? 'Master' : 'Aux'}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#333' }}>—</span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {/* Ativar */}
                      {u.account_status !== 'active' && (
                        <ActionBtn
                          title="Ativar conta"
                          color="#00e676"
                          hoverBg="rgba(0,230,118,0.08)"
                          icon={<UserCheck size={14} />}
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: u.membership_id, status: 'active' })}
                        />
                      )}

                      {/* Bloquear */}
                      {u.account_status !== 'blocked' && !u.is_super_admin && (
                        <ActionBtn
                          title="Bloquear conta"
                          color="#ff4444"
                          hoverBg="rgba(255,68,68,0.08)"
                          icon={<ShieldOff size={14} />}
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: u.membership_id, status: 'blocked' })}
                        />
                      )}

                      {/* Grant / revoke aux — somente master */}
                      {isMaster && !u.is_super_admin && (
                        <ActionBtn
                          title="Tornar Super Admin Auxiliar"
                          color="#a78bfa"
                          hoverBg="rgba(167,139,250,0.08)"
                          icon={<Star size={14} />}
                          disabled={grantAuxMutation.isPending}
                          onClick={() => grantAuxMutation.mutate(u.user_id)}
                        />
                      )}
                      {isMaster && u.is_super_admin && u.super_admin_type === 'auxiliary' && (
                        <ActionBtn
                          title="Revogar Super Admin Auxiliar"
                          color="#ff4444"
                          hoverBg="rgba(255,68,68,0.08)"
                          icon={<StarOff size={14} />}
                          disabled={revokeAuxMutation.isPending}
                          onClick={() => revokeAuxMutation.mutate(u.user_id)}
                        />
                      )}

                      {/* Reenviar/redefinir senha — envia link por e-mail */}
                      <ActionBtn
                        title="Enviar link de redefinição de senha"
                        color="#40a0ff"
                        hoverBg="rgba(64,160,255,0.08)"
                        icon={<KeyRound size={14} />}
                        disabled={false}
                        onClick={() => handleResetPassword(u)}
                      />

                      {/* Remover usuário — nunca remove master */}
                      {!u.is_super_admin && (
                        <ActionBtn
                          title="Remover usuário da plataforma"
                          color="#ff4444"
                          hoverBg="rgba(255,68,68,0.08)"
                          icon={<Trash2 size={14} />}
                          disabled={removeMutation.isPending}
                          onClick={() => setConfirmRemove(u)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PlatformInviteModal open={showInvite} onClose={() => setShowInvite(false)} />
      <SignupLinkModal
        open={showSignupLink}
        onClose={() => setShowSignupLink(false)}
        showTenantPicker
        availableTenants={allTenants}
      />

      {/* Modal de confirmação de remoção */}
      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Excluir usuário permanentemente"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}
              disabled={removeMutation.isPending}>
              Cancelar
            </Button>
            <Button
              loading={removeMutation.isPending}
              onClick={() => confirmRemove && removeMutation.mutate(confirmRemove.user_id)}
              style={{ background: '#ff4444', color: '#fff' }}
            >
              Excluir permanentemente
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: '#aaa' }}>
            Tem certeza que deseja excluir{' '}
            <strong style={{ color: '#e8e8e8' }}>
              {confirmRemove?.full_name ?? confirmRemove?.email}
            </strong>?
          </p>
          <div className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.15)', color: '#ff6666' }}>
            ⚠️ <strong>Ação irreversível.</strong> O usuário será removido completamente:
            conta de login, membership, atividades e todos os dados associados.
          </div>
          {removeMutation.error && (
            <p className="text-xs rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444' }}>
              {(removeMutation.error as Error).message}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ── Dropdown inline de role ───────────────────────────────────────────────────

function RoleDropdown({ currentRole, onChange, disabled }: {
  currentRole: string
  onChange: (role: string) => void
  disabled: boolean
}) {
  const [open, setOpen]     = useState(false)
  const [position, setPos]  = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef              = useRef<HTMLButtonElement>(null)

  const roles = [
    { value: 'seller',  label: 'Vendedor', color: '#888'    },
    { value: 'manager', label: 'Gestor',   color: '#a78bfa' },
    { value: 'admin',   label: 'Admin',    color: '#ff4444' },
  ]
  const current = roles.find((r) => r.value === currentRole) ?? roles[0]

  // Calcula a posição do dropdown baseado no botão (renderizado em portal)
  // Abre para cima se não houver espaço suficiente abaixo
  useEffect(() => {
    if (open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect()
      const menuHeight = 110  // estimativa: 3 opções × ~36px
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp     = spaceBelow < menuHeight + 8
      setPos(
        openUp
          ? { top: rect.top - menuHeight - 4, left: rect.left }
          : { top: rect.bottom + 4,           left: rect.left },
      )
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-all disabled:opacity-50"
        style={{ color: current.color, background: 'transparent' }}
      >
        {current.label}
        <ChevronDown size={10} />
      </button>

      {open && createPortal(
        <>
          {/* Overlay capturando cliques fora */}
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          {/* Menu posicionado em portal — escapa de overflow:hidden */}
          <div
            className="fixed z-[101] rounded-lg overflow-hidden shadow-xl"
            style={{
              top:        position.top,
              left:       position.left,
              background: '#1a1a1a',
              border:     '1px solid #2a2a2a',
              minWidth:   110,
            }}
          >
            {roles.map((r) => (
              <button
                key={r.value}
                onClick={() => { onChange(r.value); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{ color: r.color }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

// ── Botão de ação pequeno ────────────────────────────────────────────────────

function ActionBtn({ title, color, hoverBg, icon, onClick, disabled }: {
  title: string; color: string; hoverBg: string
  icon: React.ReactNode; onClick: () => void; disabled: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
      style={{ color: '#555' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = color
        ;(e.currentTarget as HTMLButtonElement).style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = '#555'
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )
}

// ── Modal de edição de tenant ─────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose }: { tenant: TenantStat | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName]         = useState(tenant?.tenant_name ?? '')
  const [features, setFeatures] = useState<string[]>(tenant?.tenant_features ?? [])
  const [plan, setPlan]         = useState<string>(tenant?.tenant_plan ?? '')
  const [err,  setErr]          = useState<string | null>(null)

  // Sincroniza os campos quando abre/troca de empresa
  useEffect(() => {
    setName(tenant?.tenant_name ?? '')
    setFeatures(tenant?.tenant_features ?? [])
    setPlan(tenant?.tenant_plan ?? '')
    setErr(null)
  }, [tenant?.tenant_id, tenant?.tenant_name])

  // Aplica um plano: grava o nome do plano + o pacote de funções de uma vez.
  const planMutation = useMutation({
    mutationFn: async (planKey: string) => {
      const p = PLAN_CATALOG.find((x) => x.key === planKey)
      if (!p) throw new Error('Plano inválido')
      const { error } = await supabase.rpc('apply_tenant_plan', {
        p_tenant_id: tenant!.tenant_id, p_plan: p.key, p_features: p.features,
      })
      if (error) throw error
      return p
    },
    onSuccess: (p) => {
      setPlan(p.key)
      setFeatures([...p.features])
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Erro ao aplicar o plano.'),
  })

  // Plano atual "puro"? (funções batem exatamente com o pacote do plano)
  const currentPlanDef = PLAN_CATALOG.find((p) => p.key === plan)
  const isCustom = currentPlanDef ? !sameFeatureSet(features, currentPlanDef.features) : features.length > 0

  // Salva as funções liberadas via RPC (SECURITY DEFINER, só super admin).
  // Auto-save no clique de cada função — feedback imediato.
  const featuresMutation = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase.rpc('set_tenant_features', {
        p_tenant_id: tenant!.tenant_id, p_features: next,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-stats'] }),
    onError: (e) => setErr(e instanceof Error ? e.message : 'Erro ao salvar funções.'),
  })

  function toggleFeature(key: string) {
    const next = features.includes(key)
      ? features.filter((f) => f !== key)
      : [...features, key]
    setFeatures(next)          // otimista
    setErr(null)
    featuresMutation.mutate(next)
  }

  // Nome — via update direto (comportamento existente)
  const nameMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tenants').update({ name: name.trim() }).eq('id', tenant!.tenant_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      onClose()
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Erro ao salvar o nome.'),
  })

  if (!tenant) return null

  return (
    <Modal open={!!tenant} onClose={onClose} title="Editar empresa" size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={nameMutation.isPending}>Fechar</Button>
          <Button loading={nameMutation.isPending} onClick={() => nameMutation.mutate()}>
            Salvar nome
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Nome da empresa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Plano — aplica um pacote de funções de uma vez */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Plano
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_CATALOG.map((p) => {
              const active = plan === p.key
              return (
                <button
                  key={p.key}
                  onClick={() => planMutation.mutate(p.key)}
                  disabled={planMutation.isPending}
                  className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-2.5 transition-colors disabled:opacity-60"
                  style={{
                    background: active ? 'rgba(0,230,118,0.08)' : '#141414',
                    border: `1px solid ${active ? 'var(--tenant-primary)' : '#1e1e1e'}`,
                  }}
                >
                  <span className="text-xs font-bold" style={{ color: active ? 'var(--tenant-primary)' : '#e8e8e8' }}>{p.label}</span>
                  <span className="text-[10px]" style={{ color: '#666' }}>{p.price}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[11px]" style={{ color: '#555' }}>
            {currentPlanDef
              ? <>Plano <strong style={{ color: '#888' }}>{currentPlanDef.label}</strong>{isCustom && <span style={{ color: '#fbbf24' }}> · personalizado</span>}</>
              : 'Escolha um plano ou ajuste as funções abaixo manualmente.'}
          </p>
        </div>

        {/* Funções liberadas — ajuste fino por empresa (salva na hora) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Funções (ajuste fino)
          </label>
          <p className="text-[11px] -mt-1" style={{ color: '#555' }}>
            Liga/desliga função específica além do plano (ex.: liberar um teste). Vale pra todos da empresa — mesmo admin não vê a função se estiver desligada.
          </p>
          <div className="flex flex-col gap-1.5 mt-1">
            {FEATURE_CATALOG.map((f) => {
              const on = features.includes(f.key)
              return (
                <button
                  key={f.key}
                  onClick={() => toggleFeature(f.key)}
                  disabled={featuresMutation.isPending}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-60"
                  style={{
                    background: on ? 'rgba(0,230,118,0.06)' : '#141414',
                    border: `1px solid ${on ? 'rgba(0,230,118,0.3)' : '#1e1e1e'}`,
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: on ? '#e8e8e8' : '#999' }}>{f.label}</p>
                    <p className="text-[10px] truncate" style={{ color: '#555' }}>{f.description}</p>
                  </div>
                  {/* Switch */}
                  <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
                    style={{ background: on ? '#00e676' : '#2a2a2a' }}>
                    <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                      style={{ left: on ? 18 : 2 }} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg px-3 py-2 text-xs"
          style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}>
          <span style={{ color: '#444' }}>Slug:</span>{' '}
          <span style={{ color: '#777' }}>/{tenant.tenant_slug}</span>
          <span className="mx-2" style={{ color: '#333' }}>·</span>
          <span style={{ color: '#444' }}>Criado em:</span>{' '}
          <span style={{ color: '#777' }}>{formatDate(tenant.tenant_created_at)}</span>
        </div>
        {err && (
          <p className="text-xs rounded-lg px-3 py-2"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{err}</p>
        )}
      </div>
    </Modal>
  )
}

// ── Aba Empresas (com edição e exclusão) ──────────────────────────────────────

function TenantsTab() {
  const queryClient = useQueryClient()
  const currentTenantId = useAuthStore((s) => s.tenant?.id)
  const [editing,  setEditing]  = useState<TenantStat | null>(null)
  const [deleting, setDeleting] = useState<TenantStat | null>(null)
  const [inviting, setInviting] = useState<TenantStat | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [deleteErr,   setDeleteErr]   = useState<string | null>(null)
  const [ordem,       setOrdem]       = useState<Ordem>('recentes')

  const { data: todas = [], isLoading, error } = useQuery({
    queryKey: ['platform-stats'],
    queryFn:  fetchPlatformStats,
  })

  const tenants = ordenar(todas, ordem, (t) => t.tenant_name, (t) => t.tenant_created_at)

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc('toggle_tenant_active', { p_tenant_id: id, p_active: active })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-stats'] }),
  })

  const deleteMutation = useMutation({
    // Uma RPC, não uma cadeia de deletes pelo navegador. A versão anterior
    // apagava tabela por tabela e por último `tenants` — que tem RLS só de
    // SELECT, então o DELETE não apagava nada e devolvia sucesso com zero
    // linhas. A tela dizia que excluiu e a empresa continuava lá.
    mutationFn: async (tenantId: string) => {
      const { data, error } = await supabase.rpc('delete_tenant_completely', { p_tenant_id: tenantId })
      if (error) throw error
      // Zero linha significa que não achou (ou não pôde). Sem essa checagem o
      // silêncio volta a parecer sucesso, que foi exatamente o defeito.
      if (!data) throw new Error('Nenhuma empresa foi excluída. Recarregue a página e tente de novo.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      setDeleting(null)
      setConfirmName('')
    },
    onError: (e) => setDeleteErr(e instanceof Error ? e.message : 'Erro ao excluir.'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  if (error) return (
    <div className="rounded-xl p-8 text-center text-sm"
      style={{ background: '#141414', border: '1px solid #1e1e1e', color: '#ff4444' }}>
      Erro ao carregar empresas. Execute <code>platform_functions.sql</code> no Supabase.
    </div>
  )

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs" style={{ color: '#555' }}>
          {tenants.length} {tenants.length === 1 ? 'empresa' : 'empresas'}
        </p>
        <SortControl ordem={ordem} onChange={setOrdem} />
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
              {['Empresa', 'Dono', 'Plano', 'Usuários', 'Leads', 'Criado em', 'Status', 'Ações'].map((h, i) => (
                <th key={h}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${i >= 6 ? 'text-center' : 'text-left'}`}
                  style={{ color: '#444' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const isOwnTenant = t.tenant_id === currentTenantId
              return (
              <tr key={t.tenant_id}
                style={{ borderBottom: '1px solid #191919' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>

                <td className="px-4 py-3">
                  <p className="font-medium text-xs flex items-center gap-2" style={{ color: '#e8e8e8' }}>
                    {t.tenant_name}
                    {isOwnTenant && (
                      <span className="text-[9px] font-medium rounded-full px-1.5 py-0.5"
                        style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                        SUA EMPRESA
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#444' }}>/{t.tenant_slug}</p>
                </td>

                {/* Dono: o admin mais antigo da empresa. Muita gente não tem
                    nome preenchido no perfil, então o e-mail é o que sempre
                    identifica — sem ele a coluna ficaria vazia sem motivo
                    aparente. */}
                <td className="px-4 py-3">
                  {t.owner_email ? (
                    <>
                      {t.owner_name && (
                        <p className="text-xs" style={{ color: '#ccc' }}>{t.owner_name}</p>
                      )}
                      <p className="text-[11px]" style={{ color: t.owner_name ? '#555' : '#aaa' }}>
                        {t.owner_email}
                      </p>
                    </>
                  ) : (
                    <span className="text-[11px]" style={{ color: '#444' }}>sem responsável</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span className="text-xs font-medium rounded-full px-2.5 py-1"
                    style={
                      t.tenant_plan === 'plus'     ? { background: 'rgba(167,139,250,0.12)', color: '#a78bfa' } :
                      t.tenant_plan === 'standard' ? { background: 'rgba(0,230,118,0.12)',   color: '#00e676' } :
                      t.tenant_plan === 'start'    ? { background: 'rgba(64,160,255,0.12)',  color: '#40a0ff' } :
                                                     { background: '#1e1e1e', color: '#666' }
                    }>
                    {PLAN_CATALOG.find((p) => p.key === t.tenant_plan)?.label ?? t.tenant_plan}
                  </span>
                </td>

                <td className="px-4 py-3 tabular-nums text-xs" style={{ color: '#aaa' }}>{t.user_count}</td>
                <td className="px-4 py-3 tabular-nums text-xs" style={{ color: '#aaa' }}>{t.lead_count}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{formatDate(t.tenant_created_at)}</td>

                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: t.tenant_active ? '#00e676' : '#555' }}>
                    <span className="h-1.5 w-1.5 rounded-full"
                      style={{ background: t.tenant_active ? '#00e676' : '#333' }} />
                    {t.tenant_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {/* Convidar pessoa para a empresa */}
                    <ActionBtn
                      title="Convidar pessoa"
                      color="#00e676"
                      hoverBg="rgba(0,230,118,0.08)"
                      icon={<UserPlus size={13} />}
                      disabled={false}
                      onClick={() => setInviting(t)}
                    />
                    {/* Editar — sempre disponível */}
                    <ActionBtn
                      title="Editar empresa"
                      color="#40a0ff"
                      hoverBg="rgba(64,160,255,0.08)"
                      icon={<Pencil size={13} />}
                      disabled={false}
                      onClick={() => setEditing(t)}
                    />
                    {/* Ativar / Desativar — escondido na própria empresa */}
                    {!isOwnTenant && (
                      <ActionBtn
                        title={t.tenant_active ? 'Desativar' : 'Ativar'}
                        color={t.tenant_active ? '#ff4444' : '#00e676'}
                        hoverBg={t.tenant_active ? 'rgba(255,68,68,0.08)' : 'rgba(0,230,118,0.08)'}
                        icon={t.tenant_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate({ id: t.tenant_id, active: !t.tenant_active })}
                      />
                    )}
                    {/* Excluir — escondido na própria empresa */}
                    {!isOwnTenant && (
                      <ActionBtn
                        title="Excluir empresa"
                        color="#ff4444"
                        hoverBg="rgba(255,68,68,0.08)"
                        icon={<Trash2 size={14} />}
                        disabled={false}
                        onClick={() => { setDeleting(t); setConfirmName(''); setDeleteErr(null) }}
                      />
                    )}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Modal editar */}
      <EditTenantModal tenant={editing} onClose={() => setEditing(null)} />

      {/* Modal convidar pessoa */}
      <PlatformInviteModal
        open={!!inviting}
        onClose={() => setInviting(null)}
        presetTenantId={inviting?.tenant_id}
        presetTenantName={inviting?.tenant_name}
      />

      {/* Modal confirmar exclusão */}
      <Modal
        open={!!deleting}
        onClose={() => { setDeleting(null); setConfirmName('') }}
        title="Excluir empresa"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              loading={deleteMutation.isPending}
              disabled={confirmName !== deleting?.tenant_name}
              onClick={() => deleting && deleteMutation.mutate(deleting.tenant_id)}
              style={{ background: '#ff4444', color: '#fff', opacity: confirmName !== deleting?.tenant_name ? 0.4 : 1 }}
            >
              Excluir permanentemente
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg px-4 py-3 text-xs"
            style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff6666' }}>
            <strong>⚠️ Ação irreversível.</strong> Isso apagará todos os leads, pipeline,
            usuários e dados de <strong>{deleting?.tenant_name}</strong>.
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs" style={{ color: '#888' }}>
              Digite <strong style={{ color: '#e8e8e8' }}>{deleting?.tenant_name}</strong> para confirmar
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deleting?.tenant_name}
              className="h-10 w-full rounded-lg px-3 text-sm focus:outline-none"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
            />
          </div>
          {deleteErr && (
            <p className="text-xs rounded-lg px-3 py-2"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{deleteErr}</p>
          )}
        </div>
      </Modal>
    </>
  )
}

// ── Page principal ────────────────────────────────────────────────────────────

export function PlatformPage() {
  const queryClient    = useQueryClient()
  const isMaster       = useAuthStore((s) => s.isSuperAdminMaster)
  const [tab, setTab]  = useState<'users' | 'tenants'>('users')
  const [showNotifModal, setShowNotifModal] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>
            Painel da Plataforma
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            Gerencie usuários e tenants do Green Hub
            {isMaster && (
              <span className="ml-2 text-xs font-medium" style={{ color: '#fbbf24' }}>
                · Super Admin Master
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowNotifModal(true)}>
            <Send size={14} />
            Enviar Notificação
          </Button>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['platform-users'] })
              queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
            }}
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ border: '1px solid #2a2a2a', color: '#555' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            title="Atualizar"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl p-1"
        style={{ background: '#111', border: '1px solid #1a1a1a', width: 'fit-content' }}>
        {([
          { key: 'users',   label: 'Usuários',  icon: Users    },
          { key: 'tenants', label: 'Empresas',  icon: Building2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: tab === key ? '#1e1e1e' : 'transparent',
              color:      tab === key ? '#e8e8e8' : '#555',
              border:     tab === key ? '1px solid #2a2a2a' : '1px solid transparent',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      {tab === 'users'
        ? <UsersTab isMaster={isMaster} />
        : <TenantsTab />
      }

      <SendNotificationModal open={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </div>
  )
}
