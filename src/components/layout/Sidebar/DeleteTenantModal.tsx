import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

interface DeleteStats {
  lead_count:      number
  user_count:      number
  activity_count:  number
  financial_count: number
}

interface DeleteTenantModalProps {
  onClose: () => void
}

export function DeleteTenantModal({ onClose }: DeleteTenantModalProps) {
  const queryClient = useQueryClient()
  const tenant      = useAuthStore((s) => s.tenant)
  const removeTenant = useAuthStore((s) => s.removeTenant)

  const [stats, setStats]         = useState<DeleteStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError]     = useState<string | null>(null)

  const [understood, setUnderstood] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const nameMatches = confirmName.trim() === (tenant?.name ?? '').trim()
  const canDelete   = understood && nameMatches && !deleting

  // Busca estatísticas da empresa ao abrir o modal
  useEffect(() => {
    if (!tenant?.id) return
    setLoadingStats(true)

    Promise.resolve(
      supabase.rpc('get_tenant_delete_stats', { p_tenant_id: tenant.id })
    ).then(({ data, error }) => {
      if (error || !data) { setStatsError('Não foi possível carregar as estatísticas.'); return }
      setStats(data as DeleteStats)
    }).finally(() => setLoadingStats(false))
  }, [tenant?.id])

  async function handleDelete() {
    if (!canDelete || !tenant?.id) return
    setDeleting(true)
    setDeleteError(null)

    const { data, error } = await supabase.rpc('delete_tenant', { p_tenant_id: tenant.id })

    if (error || data?.error) {
      setDeleteError((data?.error as string | undefined) ?? error?.message ?? 'Erro ao excluir empresa.')
      setDeleting(false)
      return
    }

    // Remove empresa do estado e troca para outra (ou redireciona)
    queryClient.clear()
    const hasMore = removeTenant(tenant.id)

    if (!hasMore) {
      // Sem mais empresas — faz logout
      await supabase.auth.signOut()
      window.location.href = window.location.origin + window.location.pathname + '#/login'
    } else {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col gap-0 overflow-hidden"
        style={{ background: '#111', border: '1px solid #3a1a1a', boxShadow: '0 24px 80px rgba(255,0,0,0.15)' }}
      >
        {/* Cabeçalho vermelho */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between"
          style={{ borderBottom: '1px solid #2a1010' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.3)' }}>
              <Trash2 size={18} style={{ color: '#ff4444' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#ff6666' }}>Excluir empresa</h2>
              <p className="text-xs mt-0.5" style={{ color: '#666' }}>Esta ação não pode ser desfeita</p>
            </div>
          </div>
          {!deleting && (
            <button onClick={onClose}
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ color: '#555' }}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Aviso principal */}
          <div className="rounded-xl px-4 py-4 flex gap-3"
            style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}>
            <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#ff4444' }} />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold" style={{ color: '#ff6666' }}>
                Você está prestes a excluir permanentemente <span style={{ color: '#ff4444' }}>"{tenant?.name}"</span>
              </p>
              <p className="text-xs" style={{ color: '#888' }}>
                Todos os dados abaixo serão deletados do banco de dados e não poderão ser recuperados.
              </p>
            </div>
          </div>

          {/* Estatísticas */}
          {loadingStats ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : statsError ? (
            <p className="text-xs text-center" style={{ color: '#ff4444' }}>{statsError}</p>
          ) : stats && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Leads',              value: stats.lead_count      },
                { label: 'Membros',            value: stats.user_count      },
                { label: 'Disparos/atividades', value: stats.activity_count },
                { label: 'Registros financeiros', value: stats.financial_count },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg px-4 py-3 text-center"
                  style={{ background: '#1a1010', border: '1px solid #2a1a1a' }}>
                  <p className="text-xl font-bold tabular-nums" style={{ color: '#ff6666' }}>{value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#555' }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Checkbox de entendimento */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 shrink-0"
              style={{ accentColor: '#ff4444', width: 16, height: 16 }}
            />
            <span className="text-sm" style={{ color: understood ? '#ff8888' : '#666' }}>
              Entendo que todos os dados serão perdidos permanentemente e não há como desfazer.
            </span>
          </label>

          {/* Input de confirmação */}
          <div className="flex flex-col gap-2">
            <label className="text-xs" style={{ color: '#666' }}>
              Para confirmar, digite exatamente:{' '}
              <span className="font-mono font-semibold" style={{ color: '#ff8888' }}>
                {tenant?.name}
              </span>
            </label>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={tenant?.name}
              disabled={deleting}
              className="h-10 w-full rounded-lg px-3 text-sm focus:outline-none font-mono disabled:opacity-50"
              style={{
                background: '#1a0a0a',
                border: `1px solid ${nameMatches && confirmName ? 'rgba(255,68,68,0.5)' : '#2a1a1a'}`,
                color: '#e8e8e8',
              }}
            />
          </div>

          {/* Erro */}
          {deleteError && (
            <p className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.2)' }}>
              {deleteError}
            </p>
          )}

          {/* Botões */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <button
              onClick={handleDelete}
              disabled={!canDelete}
              className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: canDelete ? 'rgba(255,68,68,0.9)' : 'rgba(255,68,68,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,68,68,0.5)',
              }}
            >
              {deleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
              {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
