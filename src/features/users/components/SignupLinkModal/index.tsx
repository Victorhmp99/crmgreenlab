import { useMemo, useState } from 'react'
import { CheckCircle, Copy, Link2, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import type { UserRole } from '@/types'

interface SignupLinkModalProps {
  open:    boolean
  onClose: () => void
  /** Super admin: pode escolher em qual tenant um vendedor vai entrar */
  showTenantPicker?: boolean
  availableTenants?: { id: string; name: string }[]
}

interface RoleOption {
  value:       UserRole
  label:       string
  description: string
  color:       string
}

const ROLE_DEFS: Record<UserRole, RoleOption> = {
  admin:   { value: 'admin',   label: 'Administrador', color: '#ff4444',
             description: 'Cria nova empresa com acesso total' },
  manager: { value: 'manager', label: 'Gestor',        color: '#a78bfa',
             description: 'Cria nova empresa como gestor responsável' },
  seller:  { value: 'seller',  label: 'Vendedor',      color: '#888',
             description: 'Entra em uma empresa como vendedor' },
}

export function SignupLinkModal({ open, onClose, showTenantPicker, availableTenants }: SignupLinkModalProps) {
  const { isSuperAdmin, isAdmin } = usePermissions()
  const currentTenant             = useAuthStore((s) => s.tenant)
  const currentMembership         = useAuthStore((s) => s.membership)

  // Define os roles permitidos baseado no caller
  // - Super admin: admin + manager + seller
  // - Admin: manager + seller
  // - Manager (gestor): só seller
  const allowedRoles: UserRole[] = useMemo(() => {
    if (isSuperAdmin) return ['admin', 'manager', 'seller']
    if (isAdmin)      return ['manager', 'seller']
    if (currentMembership?.role === 'manager') return ['seller']
    return []
  }, [isSuperAdmin, isAdmin, currentMembership])

  const [role, setRole]         = useState<UserRole>(allowedRoles[0] ?? 'seller')
  const [tenantId, setTenantId] = useState<string>('')
  const [token, setToken]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [copied, setCopied]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  // Quando o picker de tenant deve aparecer:
  // Apenas super admin selecionando vendedor (decide em qual tenant o vendedor entra)
  const needsTenantPicker = isSuperAdmin && role === 'seller' && showTenantPicker

  // O que o link vai fazer (descrição na UI)
  const willJoinExisting = role === 'seller'
  const targetTenantName = needsTenantPicker
    ? availableTenants?.find((t) => t.id === tenantId)?.name
    : currentTenant?.name

  async function handleGenerate() {
    setLoading(true); setErr(null); setToken(null)
    try {
      // target_tenant_id:
      // - admin/manager: SEMPRE null (cria nova empresa)
      // - seller (super admin): tenant escolhido
      // - seller (admin/gestor): backend força o próprio tenant — passa null
      const targetTenantId =
        role !== 'seller' ? null :
        needsTenantPicker ? (tenantId || null) :
        null  // backend força o tenant do caller

      const { data, error } = await supabase.rpc('create_signup_token', {
        p_role:             role,
        p_target_tenant_id: targetTenantId,
      })
      if (error) throw error
      setToken(data as string)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar link.')
    } finally {
      setLoading(false)
    }
  }

  const fullUrl = token
    ? `${window.location.origin}${window.location.pathname}#/registrar?ref=${token}`
    : ''

  async function copyUrl() {
    if (!fullUrl) return
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {/* silencioso */}
  }

  function handleClose() {
    setToken(null); setCopied(false); setErr(null)
    setRole(allowedRoles[0] ?? 'seller'); setTenantId('')
    onClose()
  }

  const selectedRole = ROLE_DEFS[role]

  // Sem permissão pra gerar link
  if (allowedRoles.length === 0) return null

  return (
    <Modal open={open} onClose={handleClose} title="Gerar link de cadastro" size="md"
      footer={
        token ? (
          <>
            <Button variant="ghost" onClick={handleClose}>Fechar</Button>
            <Button onClick={() => setToken(null)} variant="ghost">
              <RefreshCw size={14} /> Gerar outro
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={loading}>Cancelar</Button>
            <Button onClick={handleGenerate} loading={loading}
              disabled={needsTenantPicker && !tenantId}>
              <Link2 size={14} /> Gerar link
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {!token && (
          <>
            <p className="text-sm" style={{ color: '#888' }}>
              {willJoinExisting
                ? `O link adicionará a pessoa em ${targetTenantName ?? '...'} como vendedor.`
                : `O link permitirá criar uma nova empresa como ${selectedRole.label.toLowerCase()}.`}
            </p>

            {/* Cards de role */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                Cargo da nova conta
              </label>
              {allowedRoles.map((r) => {
                const opt    = ROLE_DEFS[r]
                const active = role === opt.value
                return (
                  <button key={opt.value}
                    onClick={() => setRole(opt.value)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all"
                    style={{
                      background: active ? 'rgba(0,230,118,0.06)' : '#0f0f0f',
                      border:     active ? '1px solid rgba(0,230,118,0.3)' : '1px solid #1e1e1e',
                    }}>
                    <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ background: `${opt.color}22`, color: opt.color }}>
                      {opt.label[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold" style={{ color: '#e8e8e8' }}>{opt.label}</p>
                      <p className="text-[10px]" style={{ color: '#555' }}>{opt.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Tenant picker — só super admin escolhendo vendedor */}
            {needsTenantPicker && availableTenants && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                  Empresa de destino *
                </label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="h-10 rounded-lg px-3 text-sm focus:outline-none"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
                >
                  <option value="">Selecione a empresa...</option>
                  {availableTenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[10px]" style={{ color: '#555' }}>
                  O vendedor vai entrar nesta empresa como integrante.
                </p>
              </div>
            )}

            {err && (
              <p className="text-xs rounded-lg px-3 py-2"
                style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{err}</p>
            )}
          </>
        )}

        {loading && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}

        {token && (
          <>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.15)', color: '#00e676' }}>
              <CheckCircle size={14} />
              {willJoinExisting
                ? <>Link gerado pra adicionar <strong>{selectedRole.label}</strong> em <strong>{targetTenantName}</strong></>
                : <>Link gerado pra criar nova empresa como <strong>{selectedRole.label}</strong></>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                Link completo
              </label>
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-lg px-3 py-2 text-xs font-mono break-all"
                  style={{ background: '#111', border: '1px solid #1a1a1a', color: '#aaa' }}>
                  {fullUrl}
                </span>
                <button onClick={copyUrl}
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

            <div className="rounded-lg px-3 py-2 text-xs"
              style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}>
              ⏰ <strong style={{ color: '#888' }}>Validade:</strong> 7 dias ·{' '}
              🔒 <strong style={{ color: '#888' }}>Uso único:</strong> link expira após o primeiro cadastro
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
