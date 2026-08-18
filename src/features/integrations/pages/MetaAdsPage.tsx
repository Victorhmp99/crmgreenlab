import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Link2, AlertTriangle, CheckCircle, Trash2, ExternalLink, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import {
  fetchMetaCredentials,
  saveMetaToken,
  deleteMetaCredentials,
  fetchCampaigns,
  fetchAdAccounts,
  addAdAccount,
  removeAdAccount,
  toggleAdAccount,
  syncMetaAds,
  presetLabel,
  DATE_PRESETS,
  type DatePreset,
} from '@/services/metaAds'
import { Select } from '@/components/ui/Select'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/** Célula numérica da tabela — trata null como travessão em vez de 0. */
function Num({ v, fmt, color = '#888', bold }: {
  v: number | null | undefined
  fmt?: (n: number) => string
  color?: string
  bold?: boolean
}) {
  return (
    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap"
      style={{ color: v != null ? color : '#333', fontWeight: bold ? 600 : undefined }}>
      {v != null ? (fmt ? fmt(v) : v.toLocaleString('pt-BR')) : '—'}
    </td>
  )
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS:        'Cadastros',
  OUTCOME_SALES:        'Vendas',
  OUTCOME_ENGAGEMENT:   'Engajamento',
  OUTCOME_TRAFFIC:      'Tráfego',
  OUTCOME_AWARENESS:    'Reconhecimento',
  OUTCOME_APP_PROMOTION:'Promoção de app',
  LEAD_GENERATION:      'Cadastros',
  MESSAGES:             'Mensagens',
  CONVERSIONS:          'Conversões',
  LINK_CLICKS:          'Tráfego',
  POST_ENGAGEMENT:      'Engajamento',
}

function translateObjective(o: string): string {
  return OBJECTIVE_LABELS[o] ?? o.replace(/^OUTCOME_/, '').toLowerCase()
}

function TotalCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: '#555' }}>{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: '#444' }}>{sub}</p>}
    </div>
  )
}

export function MetaAdsPage() {
  const confirm = useConfirm()
  const tenantId = useAuthStore((s) => s.tenant?.id)!
  const queryClient = useQueryClient()
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncOk,    setSyncOk]    = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [preset,    setPreset]    = useState<DatePreset>('last_30d')
  const [tokenInput,   setTokenInput]   = useState('')
  const [accountInput, setAccountInput] = useState('')
  const [labelInput,   setLabelInput]   = useState('')

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

  const { data: adAccounts = [] } = useQuery({
    queryKey: ['meta-ad-accounts', tenantId],
    queryFn:  () => fetchAdAccounts(tenantId),
    enabled:  !!tenantId,
  })

  function invalidateAccounts() {
    queryClient.invalidateQueries({ queryKey: ['meta-ad-accounts', tenantId] })
  }

  const saveTokenMutation = useMutation({
    mutationFn: (token: string) => saveMetaToken(tenantId, token),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] })
      setTokenInput('')
    },
  })

  const addAccountMutation = useMutation({
    mutationFn: () => addAdAccount(tenantId, accountInput, labelInput),
    onSuccess:  () => { invalidateAccounts(); setAccountInput(''); setLabelInput('') },
    onError:    (e) => setFormError(e instanceof Error ? e.message : 'Erro ao adicionar conta'),
  })

  const removeAccountMutation = useMutation({
    mutationFn: removeAdAccount, onSuccess: invalidateAccounts,
  })

  const toggleAccountMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleAdAccount(id, active),
    onSuccess:  invalidateAccounts,
  })

  async function handleSaveToken(e: FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim()) { setFormError('Cole o token de acesso.'); return }
    setFormError(null)
    await saveTokenMutation.mutateAsync(tokenInput)
  }

  function handleAddAccount(e: FormEvent) {
    e.preventDefault()
    if (!accountInput.trim()) { setFormError('Informe o ID da conta.'); return }
    setFormError(null)
    addAccountMutation.mutate()
  }

  const deleteMutation = useMutation({
    mutationFn: () => deleteMetaCredentials(tenantId),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] })
      invalidateAccounts()
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => syncMetaAds(tenantId, preset),
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

  const isConnected = !!credentials?.hasToken
  const canSync     = isConnected && adAccounts.some((a) => a.active)

  const totals = campaigns.reduce(
    (acc, c) => ({
      spend:       acc.spend       + (c.spend ?? 0),
      clicks:      acc.clicks      + (c.clicks ?? 0),
      impressions: acc.impressions + (c.impressions ?? 0),
      results:     acc.results     + (c.results ?? 0),
    }),
    { spend: 0, clicks: 0, impressions: 0, results: 0 },
  )

  // Todas as linhas vêm do mesmo período sincronizado
  const syncedPreset = campaigns[0]?.date_preset

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Meta Ads</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>Métricas de campanhas do Facebook e Instagram</p>
        </div>
        {isConnected && (
          <div className="flex items-end gap-2 shrink-0">
            <div className="w-44">
              <Select
                label="Período"
                value={preset}
                onChange={(e) => setPreset(e.target.value as DatePreset)}
                options={DATE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
            <Button
              onClick={() => syncMutation.mutate()}
              loading={syncMutation.isPending}
              disabled={!canSync}
              title={canSync ? undefined : 'Cadastre ao menos uma conta de anúncio ativa'}
              variant="secondary"
            >
              <RefreshCw size={15} />
              Sincronizar
            </Button>
          </div>
        )}
      </div>

      {/* Totais do período sincronizado */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TotalCard label="Investido"      value={formatBRL(totals.spend)} color="#ff4444" />
          <TotalCard label="Resultados"     value={String(totals.results)}
            sub="leads + conversas" color="#00e676" />
          <TotalCard label="Custo por resultado"
            value={totals.results > 0 ? formatBRL(totals.spend / totals.results) : '—'}
            color="#fbbf24" />
          <TotalCard label="Cliques"        value={totals.clicks.toLocaleString('pt-BR')}
            sub={totals.impressions > 0 ? `CTR ${((totals.clicks / totals.impressions) * 100).toFixed(2)}%` : undefined}
            color="#40a0ff" />
        </div>
      )}

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
              <p className="font-semibold mb-1.5 flex items-center gap-1.5">
                <ExternalLink size={12} /> Como conectar (leva ~5 minutos, é grátis)
              </p>
              <ol className="list-decimal ml-4 space-y-1" style={{ color: '#7bb8f0' }}>
                <li>
                  Abra o <strong>Gerenciador de Negócios</strong> do Facebook em{' '}
                  <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer"
                    className="underline" style={{ color: '#40a0ff' }}>business.facebook.com/settings</a>
                </li>
                <li>
                  No menu lateral: <strong>Usuários → Usuários do sistema</strong> → <strong>Adicionar</strong> e escolha a função <strong>Funcionário</strong>.
                  <br />
                  <span style={{ color: '#5a93c4' }}>
                    O nome precisa ser descritivo (ex: <strong>Integracao GreenHub</strong>). O Meta recusa sigla curta
                    tipo "CRM" e nomes com "Meta", "Facebook" ou "Insta" dentro.
                  </span>
                </li>
                <li>
                  Com o usuário selecionado, clique em <strong>Adicionar ativos</strong> → aba{' '}
                  <strong>Contas de anúncios</strong> → marque a sua conta → ligue <strong>Ver desempenho</strong>.
                </li>
                <li>
                  Ainda nas Configurações do Negócio: <strong>Contas → Apps → Adicionar</strong> →{' '}
                  <strong>Criar um novo ID do aplicativo</strong>. O app serve só para "assinar" o token.
                  <br />
                  <span style={{ color: '#5a93c4' }}>
                    <strong>Já tem um app no seu negócio?</strong> Pode usar o mesmo — não precisa criar outro,
                    e isso não altera o que ele já faz.
                    <br />
                    Se for criar: <strong>não passa por análise do Meta</strong> e leva ~2 min. Criando por aqui
                    ele já nasce ligado ao seu negócio. Vale a mesma regra de nome do passo 2.
                  </span>
                </li>
                <li>
                  Volte no usuário do sistema → <strong>Adicionar ativos</strong> → aba <strong>Apps</strong> →
                  marque esse app → ligue <strong>Gerenciar app</strong>.
                  <br />
                  <span style={{ color: '#5a93c4' }}>
                    Sem isso, o próximo passo mostra <em>"Nenhuma permissão disponível"</em> — o usuário precisa
                    ter função no app, não só na conta de anúncio.
                  </span>
                </li>
                <li>Agora sim: <strong>Gerar novo token</strong> → escolha o app → marque <code>ads_read</code> → copie o token.</li>
                <li>
                  Pegue o <strong>ID da conta de anúncio</strong> em{' '}
                  <strong>Contas → Contas de anúncios</strong> (ou no{' '}
                  <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer"
                    className="underline" style={{ color: '#40a0ff' }}>Gerenciador de Anúncios</a>) e cole
                  abaixo, com o prefixo <code>act_</code>.
                  <br />
                  <span style={{ color: '#5a93c4' }}>
                    Cuidado pra não confundir com o ID do <em>usuário do sistema</em> — são dois números
                    parecidos no mesmo painel. O que vale aqui é o da <strong>conta de anúncio</strong>.
                  </span>
                </li>
              </ol>
              <p className="mt-2" style={{ color: '#5a93c4' }}>
                <strong>Tem mais de uma conta de anúncio?</strong> Um token só dá conta: adicione cada conta
                como ativo do mesmo usuário do sistema (passo 3) e cadastre todas aqui embaixo.
                <br />
                O token fica guardado no servidor e é usado só para leitura — ele nunca aparece de volta nesta tela.
              </p>
            </div>

            {/* Token da empresa (um só, atende todas as contas) */}
            <form onSubmit={handleSaveToken} className="flex items-end gap-3 flex-wrap mb-5">
              <div className="flex-1 min-w-56">
                <Input
                  label={isConnected ? 'Token de acesso (salvo — cole outro para trocar)' : 'Token de acesso *'}
                  type="password"
                  placeholder={isConnected ? '•••••••• já salvo' : 'EAAxxxxx...'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                />
              </div>
              <Button type="submit" loading={saveTokenMutation.isPending} disabled={!tokenInput.trim()}>
                {isConnected ? 'Trocar token' : 'Salvar token'}
              </Button>
              {isConnected && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirm({
                      title: 'Desconectar Meta Ads',
                      message: 'Isso apaga o token salvo. As contas cadastradas continuam, mas a sincronização para até você salvar um token novo.',
                      confirmLabel: 'Desconectar', danger: true,
                    })) deleteMutation.mutate()
                  }}
                  className="flex items-center gap-1.5 text-sm transition-colors h-10"
                  style={{ color: '#ff4444' }}
                >
                  <Trash2 size={14} /> Desconectar
                </button>
              )}
            </form>

            {/* Contas de anúncio — várias por empresa, todas no mesmo token */}
            <div style={{ borderTop: '1px solid #1e1e1e' }} className="pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#666' }}>
                Contas de anúncio ({adAccounts.length})
              </p>

              {adAccounts.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-3">
                  {adAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ border: '1px solid #1e1e1e', opacity: acc.active ? 1 : 0.5 }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: '#e8e8e8' }}>
                          {acc.label || acc.ad_account_id}
                        </p>
                        {acc.label && (
                          <p className="text-[11px]" style={{ color: '#555' }}>{acc.ad_account_id}</p>
                        )}
                      </div>
                      {!acc.active && (
                        <span className="text-[10px] rounded-full px-2 py-0.5"
                          style={{ background: '#1e1e1e', color: '#888' }}>pausada</span>
                      )}
                      <button
                        onClick={() => toggleAccountMutation.mutate({ id: acc.id, active: !acc.active })}
                        title={acc.active ? 'Não sincronizar esta conta' : 'Voltar a sincronizar'}
                        className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                        style={{ color: acc.active ? '#00e676' : '#555' }}>
                        <Power size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirm({
                            title: 'Remover conta',
                            message: `Remover ${acc.label || acc.ad_account_id} da sincronização?`,
                            confirmLabel: 'Remover', danger: true,
                          })) removeAccountMutation.mutate(acc.id)
                        }}
                        title="Remover conta"
                        className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                        style={{ color: '#555' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddAccount} className="flex items-end gap-2 flex-wrap">
                <div className="w-48">
                  <Input label="ID da conta" placeholder="act_1234567890"
                    value={accountInput} onChange={(e) => setAccountInput(e.target.value)} />
                </div>
                <div className="w-44">
                  <Input label="Apelido (opcional)" placeholder="Ex: Loja SP"
                    value={labelInput} onChange={(e) => setLabelInput(e.target.value)} />
                </div>
                <Button type="submit" variant="secondary" loading={addAccountMutation.isPending}
                  disabled={!accountInput.trim()}>
                  <Plus size={14} /> Adicionar conta
                </Button>
              </form>
            </div>

            {formError && (
              <p className="text-sm rounded-lg px-3 py-2 mt-3"
                style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
                {formError}
              </p>
            )}
          </>
        )}
      </div>

      {/* Tabela de campanhas */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Campanhas</p>
          <p className="text-xs mt-0.5" style={{ color: '#555' }}>
            {campaigns.length > 0
              ? `${campaigns.length} campanhas · ${presetLabel(syncedPreset)}`
              : 'Nenhuma campanha ainda'}
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
                  {['Campanha','Status','Gasto','Alcance','Impressões','Freq.','Cliques','CTR','CPC','CPM','Resultados','Custo/result.'].map((h, i) => (
                    <th key={h} className={`px-3 py-3 text-xs font-medium uppercase tracking-wide whitespace-nowrap ${i > 1 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#444' }}
                      title={
                        h === 'Freq.'          ? 'Quantas vezes a mesma pessoa viu o anúncio'
                        : h === 'CTR'          ? 'Cliques ÷ impressões'
                        : h === 'CPC'          ? 'Custo por clique'
                        : h === 'CPM'          ? 'Custo por mil impressões'
                        : h === 'Resultados'   ? 'Leads de formulário + conversas iniciadas'
                        : h === 'Custo/result.'? 'Gasto ÷ resultados'
                        : undefined
                      }>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #191919' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3 py-3">
                      <p className="font-medium truncate max-w-[220px]" style={{ color: '#e8e8e8' }}>{c.name}</p>
                      {c.objective && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#444' }}>
                          {translateObjective(c.objective)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium rounded-full px-2.5 py-1 whitespace-nowrap"
                        style={c.status === 'ACTIVE'
                          ? { background: 'rgba(0,230,118,0.1)', color: '#00e676' }
                          : { background: '#1e1e1e', color: '#555' }}>
                        {c.status === 'ACTIVE' ? 'Ativa' : c.status === 'PAUSED' ? 'Pausada' : c.status ?? '—'}
                      </span>
                    </td>
                    <Num v={c.spend} fmt={formatBRL} bold color="#e8e8e8" />
                    <Num v={c.reach} />
                    <Num v={c.impressions} />
                    <Num v={c.frequency} fmt={(n) => n.toFixed(2)} />
                    <Num v={c.clicks} />
                    <Num v={c.ctr} fmt={(n) => `${n.toFixed(2)}%`} />
                    <Num v={c.cpc} fmt={formatBRL} />
                    <Num v={c.cpm} fmt={formatBRL} />
                    <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap"
                      style={{ color: c.results ? 'var(--tenant-primary)' : '#333' }}
                      title={`${c.leads_generated ?? 0} leads · ${c.conversations ?? 0} conversas`}>
                      {c.results || '—'}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
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

    </div>
  )
}
