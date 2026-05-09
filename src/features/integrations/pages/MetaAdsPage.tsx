import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RefreshCw, Link2, AlertTriangle, CheckCircle, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
          <h2 className="text-xl font-semibold text-slate-900">Meta Ads</h2>
          <p className="text-sm text-slate-500 mt-0.5">Métricas de campanhas do Facebook e Instagram</p>
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
        <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={16} /> Campanhas sincronizadas com sucesso!
        </div>
      )}
      {syncError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertTriangle size={16} /> {syncError}
        </div>
      )}

      {/* Configuração da API */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Link2 size={16} className={isConnected ? 'text-green-600' : 'text-slate-400'} />
          <h3 className="text-sm font-semibold text-slate-700">
            {isConnected ? 'Conta conectada' : 'Conectar conta Meta Ads'}
          </h3>
          {isConnected && credentials.syncedAt && (
            <span className="text-xs text-slate-400 ml-auto">
              Última sync: {formatDate(credentials.syncedAt)}
            </span>
          )}
        </div>

        {credLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <>
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 mb-5">
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
                    onClick={() => {
                      if (confirm('Desconectar a conta Meta Ads?')) deleteMutation.mutate()
                    }}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
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
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Campanhas Sincronizadas</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {campaigns.length > 0 ? `${campaigns.length} campanhas` : 'Nenhuma campanha ainda'}
          </p>
        </div>

        {campLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center text-slate-400">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <span className="text-2xl">📘</span>
            </div>
            <p className="text-sm font-medium">Nenhuma campanha sincronizada</p>
            <p className="text-xs">
              {isConnected
                ? 'Clique em "Sincronizar" para importar as campanhas'
                : 'Conecte sua conta Meta Ads para começar'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Campanha</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Gasto</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Impressões</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Cliques</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Leads</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">CPL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 truncate max-w-[200px]">{c.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(c.synced_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                        c.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {c.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                      {c.spend != null ? formatBRL(c.spend) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {c.impressions?.toLocaleString('pt-BR') ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {c.clicks?.toLocaleString('pt-BR') ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600 tabular-nums">
                      {c.leads_generated ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={c.cpl ? 'font-semibold text-amber-600 tabular-nums' : 'text-slate-300'}>
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
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
        <strong>⚠️ Edge Function necessária:</strong> A sincronização real requer o deploy de{' '}
        <code>supabase/functions/sync-meta-ads</code>. O código da função está em{' '}
        <code>src/services/metaAds.ts</code> → <code>EDGE_FUNCTION_STUB</code>.
      </div>
    </div>
  )
}
