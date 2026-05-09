import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Users, RefreshCw, ShieldCheck, ShieldOff, TrendingUp } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TenantStat {
  tenant_id:        string
  tenant_name:      string
  tenant_slug:      string
  tenant_plan:      string
  tenant_active:    boolean
  tenant_created_at: string
  user_count:       number
  lead_count:       number
}

// ── Serviço ───────────────────────────────────────────────────────────────────

async function fetchPlatformStats(): Promise<TenantStat[]> {
  const { data, error } = await supabase.rpc('get_platform_stats')
  if (error) throw error
  return (data ?? []) as TenantStat[]
}

async function toggleTenantActive(tenantId: string, active: boolean) {
  const { error } = await supabase.rpc('toggle_tenant_active', {
    p_tenant_id: tenantId,
    p_active:    active,
  })
  if (error) throw error
}

// ── Componentes ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl p-5 flex items-center gap-4"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color }}>
        <Icon size={20} style={{ color: '#000' }} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{value}</p>
        <p className="text-sm" style={{ color: '#555' }}>{label}</p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PlatformPage() {
  const queryClient = useQueryClient()

  const { data: tenants = [], isLoading, error } = useQuery({
    queryKey: ['platform-stats'],
    queryFn:  fetchPlatformStats,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleTenantActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-stats'] }),
  })

  const totalUsers = tenants.reduce((s, t) => s + Number(t.user_count), 0)
  const totalLeads = tenants.reduce((s, t) => s + Number(t.lead_count), 0)
  const activeTenantsCount = tenants.filter((t) => t.tenant_active).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>
            Painel da Plataforma
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            Gerencie todos os tenants cadastrados no Green Hub
          </p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['platform-stats'] })}
          className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ border: '1px solid #2a2a2a', color: '#555' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          title="Atualizar"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tenants ativos" value={activeTenantsCount}
          icon={Building2} color="rgba(0,230,118,0.2)" />
        <StatCard label="Total de tenants" value={tenants.length}
          icon={Building2} color="rgba(64,160,255,0.2)" />
        <StatCard label="Usuários totais" value={totalUsers}
          icon={Users} color="rgba(167,139,250,0.2)" />
        <StatCard label="Leads totais" value={totalLeads}
          icon={TrendingUp} color="rgba(251,191,36,0.2)" />
      </div>

      {/* Tabela de tenants */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="rounded-xl p-8 text-center"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <p className="text-sm" style={{ color: '#ff4444' }}>
            Erro ao carregar dados. Verifique se a função SQL foi criada no Supabase.
          </p>
          <p className="text-xs mt-2" style={{ color: '#444' }}>
            Execute o arquivo <code>supabase/platform_functions.sql</code> no SQL Editor.
          </p>
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-xl p-16 text-center"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <Building2 size={32} className="mx-auto mb-3" style={{ color: '#333' }} />
          <p className="text-sm" style={{ color: '#555' }}>Nenhum tenant cadastrado ainda</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
                {['Empresa', 'Plano', 'Usuários', 'Leads', 'Criado em', 'Status', 'Ações'].map((h, i) => (
                  <th key={h}
                    className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${i >= 5 ? 'text-center' : 'text-left'}`}
                    style={{ color: '#444' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.tenant_id}
                  style={{ borderBottom: '1px solid #191919' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: '#e8e8e8' }}>{t.tenant_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#444' }}>/{t.tenant_slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium rounded-full px-2.5 py-1"
                      style={
                        t.tenant_plan === 'pro'
                          ? { background: 'rgba(0,230,118,0.12)', color: '#00e676' }
                          : t.tenant_plan === 'business'
                          ? { background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }
                          : { background: '#1e1e1e', color: '#666' }
                      }>
                      {t.tenant_plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#aaa' }}>
                    {t.user_count}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: '#aaa' }}>
                    {t.lead_count}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>
                    {formatDate(t.tenant_created_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: t.tenant_active ? '#00e676' : '#555' }}>
                      <span className="h-1.5 w-1.5 rounded-full"
                        style={{ background: t.tenant_active ? '#00e676' : '#333' }} />
                      {t.tenant_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: t.tenant_id, active: !t.tenant_active })}
                      disabled={toggleMutation.isPending}
                      className="h-8 w-8 rounded-lg flex items-center justify-center mx-auto transition-colors disabled:opacity-40"
                      style={{ color: '#555' }}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement
                        btn.style.color = t.tenant_active ? '#ff4444' : '#00e676'
                        btn.style.background = t.tenant_active ? 'rgba(255,68,68,0.08)' : 'rgba(0,230,118,0.08)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = '#555'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      }}
                      title={t.tenant_active ? 'Desativar' : 'Ativar'}
                    >
                      {t.tenant_active ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
