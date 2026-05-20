import { useState } from 'react'
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
  /** Quando true, mostra escolha de tenant (super admin only) */
  showTenantPicker?: boolean
  /** Lista de tenants para super admin escolher (opcional) */
  availableTenants?: { id: string; name: string }[]
}

interface RoleOption {
  value: UserRole
  label: string
  description: string
  color: string
}

const ALL_ROLES: RoleOption[] = [
  { value: 'admin',   label: 'Administrador', description: 'Cria nova empresa com acesso total',     color: '#ff4444' },
  { value: 'manager', label: 'Gestor',        description: 'Entra na empresa como gestor',           color: '#a78bfa' },
  { value: 'seller',  label: 'Vendedor',      description: 'Entra na empresa como vendedor',         color: '#888'    },
]

export function SignupLinkModal({ open, onClose, showTenantPicker, availableTenants }: SignupLinkModalProps) {
  const { isSuperAdmin } = usePermissions()
  const currentTenant    = useAuthStore((s) => s.tenant)

  // Roles permitidos: super admin tem todos; admin só manager/seller
  const allowedRoles = isSuperAdmin
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => r.value !== 'admin')

  const [role, setRole]         = useState<UserRole>(allowedRoles[0].value)
  const [tenantId, setTenantId] = useState<string>('')
  const [token, setToken]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [copied, setCopied]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true); setErr(null); setToken(null)
    try {
      // Para admin role: tenant_id null (cria nova empresa)
      // Para manager/seller: tenant_id é o tenant escolhido ou o tenant atual
      const targetTenantId =
        role === 'admin'           ? null :
        tenantId                   ? tenantId :
        currentTenant?.id ?? null

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
    setRole(allowedRoles[0].value); setTenantId('')
    onClose()
  }

  const selectedRole = ALL_ROLES.find((r) => r.value === role)!

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
            <Button onClick={handleGenerate} loading={loading}>
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
              {role === 'admin'
                ? 'O link criará uma nova empresa. A pessoa preenche nome, email e senha — vira admin da nova empresa.'
                : `O link adicionará a pessoa em ${tenantId
                    ? availableTenants?.find((t) => t.id === tenantId)?.name
                    : currentTenant?.name} como ${selectedRole.label.toLowerCase()}.`}
            </p>

            {/* Seleção de role */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                Cargo da nova conta
              </label>
              <div className="grid grid-cols-1 gap-2">
                {allowedRoles.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRole(opt.value)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all"
                    style={{
                      background: role === opt.value ? 'rgba(0,230,118,0.06)' : '#0f0f0f',
                      border:     role === opt.value ? '1px solid rgba(0,230,118,0.3)' : '1px solid #1e1e1e',
                    }}
                  >
                    <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ background: `${opt.color}22`, color: opt.color }}>
                      {opt.label[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold" style={{ color: '#e8e8e8' }}>{opt.label}</p>
                      <p className="text-[10px]" style={{ color: '#555' }}>{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tenant picker — só super admin com showTenantPicker E role != admin */}
            {showTenantPicker && role !== 'admin' && availableTenants && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
                  Empresa de destino
                </label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="h-10 rounded-lg px-3 text-sm focus:outline-none"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
                >
                  <option value="">Selecione...</option>
                  {availableTenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[10px]" style={{ color: '#555' }}>
                  A nova conta vai entrar nesta empresa como {selectedRole.label.toLowerCase()}.
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
              Link gerado pra criar conta de <strong>{selectedRole.label}</strong>
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
