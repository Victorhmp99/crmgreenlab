import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RefreshCw, Link2, AlertTriangle, CheckCircle, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import {
  fetchMetaCredentials,
  saveMetaCredentials,
  deleteMetaCredentials,
  fetchCampaigns,
  syncMetaAds,
} from '@/services/metaAds'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'

const schema = z.object({
  appId:       z.string().min(1, 'App ID obrigatório'),
  accessToken: z.string().min(10, 'Token inválido'),
  adAccountId: z.string().min(1, 'Ad Account ID obrigatório'),
})
type FormData = z.infer<typeof schema>

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function MetaAdsPage() {
  const confirm = useConfirm()
  const tenantId = useAuthStore((s) => s.tenant?.id)!
  const queryClient = useQueryClient()
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncOk,    setSyncOk]    = useState(false)

  const { data: credentials, isLoading: credLoading } = useQuery({
    queryKey: ['meta-credentials', tenantId],
    queryFn:  () => fetchMetaCredentials(tenantId),
    enabled:  !!tenantId,
  })

  const { data: campaigns = [], isLoading: campLoading } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn:  () => fetchCampaigns(tenantId),
    enabled:  !!tenantId,
  })

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => saveMetaCredentials(tenantId, data),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteMetaCredentials(tenantId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] }),
  })

  const syncMutation = useMutation({
    mutationFn: () => syncMetaAds(tenantId),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] })
      setSyncOk(true)
      setTimeout(() => setSyncOk(false), 3000)
    },
    onError: (err) => {
      setSyncError(err instanceof Error ? err.message : 'Erro na sincronização')
      setTimeout(() => setSyncError(null), 5000)
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (credentials) {
      reset({
        appId:       credentials.appId,
        accessToken: credentials.accessToken,
        adAccountId: credentials.adAccountId,
      })
    }
  }, [credentials, reset])

  const isConnected = !!credentials

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Meta Ads</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>Métricas de campanhas do Facebook e Instagram</p>
        </div>
        {isConnected && (
          <Button
            onClick={() => syncMutation.mutate()}
            loading={syncMutation.isPending}
            variant="secondary"
          >
            <RefreshCw size={15} />
            Sincronizar
          </Button>
        )}
      </div>

      {/* Status de sincronização */}
      {syncOk && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}>
          <CheckCircle size={16} /> Campanhas sincronizadas com sucesso!
        </div>
      )}
      {syncError && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444' }}>
          <AlertTriangle size={16} /> {syncError}
        </div>
      )}

      {/* Configuração da API */}
      <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        <div className="flex items-center gap-2 mb-4">
          <Link2 size={16} style={{ color: isConnected ? '#00e676' : '#555' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
            {isConnected ? 'Conta conectada' : 'Conectar conta Meta Ads'}
          </h3>
          {isConnected && credentials.syncedAt && (
            <span className="text-xs ml-auto" style={{ color: '#555' }}>
              Última sync: {formatDate(credentials.syncedAt)}
            </span>
          )}
        </div>

        {credLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <>
            <div className="rounded-xl px-4 py-3 text-xs mb-5"
              style={{ background: 'rgba(64,160,255,0.08)', border: '1px solid rgba(64,160,255,0.15)', color: '#40a0ff' }}>
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <ExternalLink size={12} /> Como obter as credenciais
              </p>
              <ol className="list-decimal ml-4 space-y-0.5">
                <li>Acesse <strong>developers.facebook.com</strong> e crie um App</li>
                <li>Gere um <strong>Long-Lived User Token</strong> com permissão <code>ads_read</code></li>
                <li>Copie o <strong>Ad Account ID</strong> do Gerenciador de Anúncios (ex: act_123456)</li>
                <li>A sincronização é feita via Supabase Edge Function — deploy necessário</li>
              </ol>
            </div>

            <form onSubmit={handleSubmit((d) => saveMutation.mutateAsync(d))} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="App ID" placeholder="1234567890" error={errors.appId?.message}      {...register('appId')} />
                <Input label="Ad Account ID" placeholder="act_1234567890" error={errors.adAccountId?.message} {...register('adAccountId')} />
                <Input label="Access Token" placeholder="EAAxxxxx..." error={errors.accessToken?.message} {...register('accessToken')} />
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" loading={isSubmitting}>
                  {isConnected ? 'Atualizar credenciais' : 'Salvar e conectar'}
                </Button>
                {isConnected && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await confirm({ title: 'Desconectar Meta Ads', message: 'Desconectar a conta Meta Ads?', confirmLabel: 'Desconectar', danger: true })) deleteMutation.mutate()
                    }}
                    className="flex items-center gap-1.5 text-sm transition-colors"
                    style={{ color: '#ff4444' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    <Trash2 size={14} /> Desconectar
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      {/* Tabela de campanhas */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Campanhas Sincronizadas</p>
          <p className="text-xs mt-0.5" style={{ color: '#555' }}>
            {campaigns.length > 0 ? `${campaigns.length} campanhas` : 'Nenhuma campanha ainda'}
          </p>
        </div>

        {campLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: '#1a1a1a' }}>
              <span className="text-2xl">📘</span>
            </div>
            <p className="text-sm font-medium" style={{ color: '#666' }}>Nenhuma campanha sincronizada</p>
            <p className="text-xs" style={{ color: '#444' }}>
              {isConnected
                ? 'Clique em "Sincronizar" para importar as campanhas'
                : 'Conecte sua conta Meta Ads para começar'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
                  {['Campanha','Status','Gasto','Impressões','Cliques','Leads','CPL'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${i > 1 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#444' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #191919' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[200px]" style={{ color: '#e8e8e8' }}>{c.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#444' }}>{formatDate(c.synced_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium rounded-full px-2.5 py-1"
                        style={c.status === 'ACTIVE'
                          ? { background: 'rgba(0,230,118,0.1)', color: '#00e676' }
                          : { background: '#1e1e1e', color: '#555' }}>
                        {c.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#e8e8e8' }}>
                      {c.spend != null ? formatBRL(c.spend) : <span style={{ color: '#333' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#888' }}>
                      {c.impressions?.toLocaleString('pt-BR') ?? <span style={{ color: '#333' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#888' }}>
                      {c.clicks?.toLocaleString('pt-BR') ?? <span style={{ color: '#333' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--tenant-primary)' }}>
                      {c.leads_generated ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tabular-nums"
                        style={{ color: c.cpl ? '#fbbf24' : '#333', fontWeight: c.cpl ? 600 : undefined }}>
                        {c.cpl ? formatBRL(c.cpl) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota sobre Edge Function */}
      <div className="rounded-xl px-4 py-3 text-xs"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
        <strong>⚠️ Edge Function necessária:</strong> A sincronização real requer o deploy de{' '}
        <code>supabase/functions/sync-meta-ads</code>. O código da função está em{' '}
        <code>src/services/metaAds.ts</code> → <code>EDGE_FUNCTION_STUB</code>.
      </div>
    </div>
  )
}
