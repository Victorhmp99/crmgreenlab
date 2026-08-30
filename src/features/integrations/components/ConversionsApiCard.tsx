import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Radio, Check, AlertTriangle, Clock, Info, ExternalLink, RefreshCw, Send,
  ChevronDown, KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  saveCapiConfig, disableCapi, fetchConversionStats, reenfileirarEventos, enviarEventosAgora,
  fetchFunisParaMapear, updateStageMetaEvent,
  META_EVENTS, META_EVENT_REGEX, isEventoPersonalizado,
  type MetaEvent, type MetaCredentials,
} from '@/services/metaAds'

/**
 * API de Conversões — devolve pro Meta o que aconteceu com o lead DEPOIS
 * que ele entrou.
 *
 * Sem isso a campanha de WhatsApp só aprende "quem mandou mensagem", que é o
 * evento mais barato e menos informativo do funil. Aqui a empresa liga o
 * dataset e escolhe, coluna a coluna, o que cada movimento significa.
 */
export function ConversionsApiCard({ tenantId, credentials }: {
  tenantId:    string
  credentials: MetaCredentials | null | undefined
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const [datasetInput, setDatasetInput] = useState(credentials?.datasetId ?? '')
  const [tokenInput,   setTokenInput]   = useState('')
  const [testeInput,   setTesteInput]   = useState(credentials?.capiTestCode ?? '')
  const [erro,         setErro]         = useState<string | null>(null)

  // No primeiro render `credentials` ainda está carregando, então o useState
  // acima nasce vazio e nunca mais se corrigia — ao recarregar a página o
  // dataset salvo sumia da tela (e o Chrome preenchia o campo vazio com um
  // e-mail salvo). Ajuste durante o render em vez de efeito: só reage quando
  // o valor SALVO muda, então refetch que devolve o mesmo dataset não
  // atropela o que a pessoa está digitando.
  const [datasetSalvo, setDatasetSalvo] = useState(credentials?.datasetId ?? null)
  if ((credentials?.datasetId ?? null) !== datasetSalvo) {
    setDatasetSalvo(credentials?.datasetId ?? null)
    setDatasetInput(credentials?.datasetId ?? '')
    setTesteInput(credentials?.capiTestCode ?? '')
  }

  const ligado = !!(credentials?.datasetId && credentials?.hasCapiToken)

  const { data: stats } = useQuery({
    queryKey: ['meta-conversion-stats', tenantId],
    queryFn:  () => fetchConversionStats(tenantId),
    enabled:  !!tenantId && ligado,
    refetchInterval: 60_000,
  })

  const { data: funis = [], isLoading: funisLoading } = useQuery({
    queryKey: ['funis-para-mapear', tenantId],
    queryFn:  () => fetchFunisParaMapear(tenantId),
    enabled:  !!tenantId && ligado,
  })

  const salvar = useMutation({
    mutationFn: () => saveCapiConfig(tenantId, datasetInput, tokenInput, testeInput),
    onSuccess: () => {
      setTokenInput('')
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] })
      invalidarKanban()
    },
    onError: (e: Error) => setErro(e.message),
  })

  const desligar = useMutation({
    mutationFn: () => disableCapi(tenantId),
    onSuccess: () => {
      setDatasetInput('')
      queryClient.invalidateQueries({ queryKey: ['meta-credentials', tenantId] })
      invalidarKanban()
    },
  })

  // Qual coluna acabou de salvar. O seletor salva sozinho ao mudar, sem botão
  // — sem um sinal de volta a pessoa fica sem saber se pegou.
  const [salvou, setSalvou] = useState<string | null>(null)

  const mapear = useMutation({
    mutationFn: ({ stageId, event }: { stageId: string; event: MetaEvent | null }) =>
      updateStageMetaEvent(stageId, event),
    onSuccess: (_, { stageId }) => {
      setSalvou(stageId)
      setTimeout(() => setSalvou((atual) => (atual === stageId ? null : atual)), 2000)
      queryClient.invalidateQueries({ queryKey: ['funis-para-mapear', tenantId] })
      // O Kanban mostra uma antena na coluna marcada — sem isso ela só
      // apareceria lá depois de recarregar a página.
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages', tenantId] })
    },
  })

  const enviarAgora = useMutation({
    mutationFn: () => enviarEventosAgora(tenantId),
    onSuccess: () => {
      // Dá tempo do Meta responder antes de reler os números, senão a tela
      // ainda mostraria a fila cheia e pareceria que o botão não fez nada.
      setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ['meta-conversion-stats', tenantId] }),
        4000,
      )
    },
  })

  const retentar = useMutation({
    mutationFn: () => reenfileirarEventos(tenantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meta-conversion-stats', tenantId] }),
  })

  // Ligar/desligar muda o que o Kanban mostra na coluna — precisa invalidar
  // junto, senão a antena só aparece (ou some) no próximo recarregamento.
  function invalidarKanban() {
    queryClient.invalidateQueries({ queryKey: ['capi-ativa', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-stages', tenantId] })
  }

  function handleSalvar(e: FormEvent) {
    e.preventDefault()
    const dataset = datasetInput.trim()

    if (!dataset) return setErro('Informe o ID do dataset (pixel).')
    // O ID do dataset é só número. Validar aqui pega de imediato o campo
    // preenchido errado — por autofill do navegador ou por ter copiado o ID
    // da conta de anúncio — em vez de deixar o erro aparecer 5 minutos
    // depois, escrito em inglês, vindo do Meta.
    if (!/^\d+$/.test(dataset)) {
      return setErro('O ID do dataset é só número. Pegue em Gerenciador de Eventos → seu pixel → Configurações.')
    }
    if (!credentials?.hasCapiToken && !tokenInput.trim()) {
      return setErro('Informe o token da API de Conversões.')
    }
    salvar.mutate()
  }

  const totalMapeado = funis.reduce(
    (s, f) => s + f.stages.filter((st) => st.meta_event).length, 0,
  )

  /* ── O que fica recolhido ──────────────────────────────────────────────
     A tela crescia até virar uma parede: explicação, passo a passo, três
     campos e TODAS as colunas de TODOS os funis, tudo aberto ao mesmo tempo.
     Quem já ligou não precisa de nada disso na frente — precisa do estado do
     envio e do mapa das colunas.

     A regra é a mesma em toda parte: aberto para quem ainda não ligou, que é
     justamente quem precisa ler; recolhido depois. */
  const [verPasso,       setVerPasso]       = useState(!ligado)
  const [verCredenciais, setVerCredenciais] = useState(!ligado)
  const [funisAbertos,   setFunisAbertos]   = useState<Record<string, boolean>>({})

  const [sincronizado, setSincronizado] = useState<boolean | null>(null)
  if (sincronizado !== ligado) {
    setSincronizado(ligado)
    setVerPasso(!ligado)
    setVerCredenciais(!ligado)
  }

  /* Com um funil só, recolher não economiza nada e ainda cobra um clique — a
     situação normal de clínica pequena. Com vários, tudo fechado. */
  const funilAberto = (id: string) => funisAbertos[id] ?? funis.length === 1

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2 mb-1">
        <Radio size={15} style={{ color: ligado ? '#00e676' : '#555' }} />
        <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
          API de Conversões
        </p>
        {ligado && (
          <span className="text-[10px] rounded-full px-2 py-0.5"
            style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>ligada</span>
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: '#444' }}>
        Ensina o Meta quem virou cliente de verdade, não só quem mandou mensagem
      </p>

      {/* Só pra quem ainda não ligou: depois de funcionando, explicar o que a
          integração faz é espaço gasto com quem já sabe. */}
      {!ligado && (
        <div className="rounded-lg p-3 mb-4 text-xs leading-relaxed"
          style={{ background: '#171717', border: '1px solid #222', color: '#999' }}>
          <p className="flex items-start gap-2">
            <Info size={13} className="shrink-0 mt-0.5" style={{ color: '#666' }} />
            <span>
              Hoje sua campanha de WhatsApp só sabe <strong style={{ color: '#ccc' }}>quem mandou
              mensagem</strong> — então ela procura mais gente que manda mensagem, não mais gente
              que compra. Ligando isso, cada vez que você move o card no funil o CRM avisa o Meta,
              e ele passa a procurar pessoas parecidas com quem{' '}
              <strong style={{ color: '#ccc' }}>fechou de verdade</strong>.
            </span>
          </p>
        </div>
      )}

      {/* ── Passo a passo ─────────────────────────────────────────────── */}
      {/* Continua disponível depois de ligado: é onde está a explicação do
          passo do pixel, que é o que trava quando alguém troca de token. */}
      <div className="rounded-xl text-xs mb-5 overflow-hidden"
        style={{ background: 'rgba(64,160,255,0.08)', border: '1px solid rgba(64,160,255,0.15)' }}>
        <button type="button" onClick={() => setVerPasso((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 transition-colors"
          style={{ color: '#40a0ff' }}>
          <span className="font-semibold flex items-center gap-1.5">
            <ExternalLink size={12} /> Como ligar (leva ~5 minutos, é grátis)
          </span>
          <ChevronDown size={14}
            style={{ transform: verPasso ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>

        {verPasso && (
        <div className="px-4 pb-3">
          <ol className="list-decimal ml-4 space-y-1" style={{ color: '#7bb8f0' }}>
            <li>
              Abra o <strong>Gerenciador de Eventos</strong> em{' '}
              <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer"
                className="underline" style={{ color: '#40a0ff' }}>business.facebook.com/events_manager</a>{' '}
              → clique no seu <strong>pixel</strong> → <strong>Configurações</strong> → copie o{' '}
              <strong>ID do dataset</strong>.
              <br />
              <span style={{ color: '#5a93c4' }}>
                É o mesmo número que aparece como "ID do pixel". Não confunda com o ID da conta
                de anúncio (aquele começa com <code>act_</code>).
              </span>
            </li>
            <li>
              Vá nas <strong>Configurações do Negócio</strong> →{' '}
              <strong>Usuários → Usuários do sistema</strong> → clique no mesmo usuário que você
              já usa aqui → <strong>Adicionar ativos</strong> → aba{' '}
              <strong>Fontes de dados</strong> → marque o seu <strong>pixel</strong> → ligue{' '}
              <strong>Gerenciar</strong>.
              <br />
              <span style={{ color: '#5a93c4' }}>
                <strong>Este é o passo que trava.</strong> Ter a conta de anúncio atribuída não
                basta — se o pixel não estiver na lista de ativos, o Meta recusa o envio dizendo
                que falta permissão.
              </span>
            </li>
            <li>
              Ainda no usuário do sistema: <strong>Gerar novo token</strong> → escolha o app →
              marque <code>ads_management</code> → copie.
              <br />
              <span style={{ color: '#5a93c4' }}>
                É um token <strong>diferente</strong> do de leitura que você salvou acima. Aquele
                só lê campanha; este escreve evento. Os dois convivem sem problema.
              </span>
            </li>
            <li>Cole o ID do dataset e o token nos campos abaixo e clique em <strong>Ligar envio</strong>.</li>
            <li>
              Vai aparecer a lista das colunas do seu funil. Marque em cada uma o que ela
              significa: <strong>Lead qualificado</strong>, <strong>Agendou</strong> ou{' '}
              <strong>Fechou</strong>.
              <br />
              <span style={{ color: '#5a93c4' }}>
                Deixe em "não manda nada" as colunas de Perdido, No-show e Desqualificado — isso
                é de propósito, o Meta não aprende com evento negativo.
              </span>
            </li>
          </ol>
          <p className="mt-2" style={{ color: '#5a93c4' }}>
            Depois disso é automático: sua equipe move o card como já faz, e o evento sai sozinho
            em até 5 minutos. <strong>Só vale daqui pra frente</strong> — movimento de card feito
            antes de ligar não é enviado.
          </p>
        </div>
        )}
      </div>

      {/* Credenciais são de configuração: preenchidas uma vez e revisitadas só
          quando um token vence. Ficavam ocupando o meio do card pra sempre. */}
      {ligado && (
        <button type="button" onClick={() => setVerCredenciais((v) => !v)}
          className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 mb-4 transition-colors"
          style={{ background: '#171717', border: '1px solid #222' }}>
          <span className="flex items-center gap-2 text-xs" style={{ color: '#888' }}>
            <KeyRound size={12} style={{ color: '#555' }} />
            Credenciais
            {credentials?.datasetId && (
              <span style={{ color: '#555' }}>· dataset {credentials.datasetId}</span>
            )}
          </span>
          <ChevronDown size={14} style={{
            color: '#555',
            transform: verCredenciais ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }} />
        </button>
      )}

      {/* autoComplete desligado nos dois: um campo de texto seguido de um
          type="password" faz o Chrome tratar o par como formulário de login e
          despejar e-mail e senha salvos por cima. Aconteceu de verdade — o
          campo de dataset apareceu preenchido com um endereço de e-mail. */}
      {verCredenciais && (
      <form onSubmit={handleSalvar} autoComplete="off" className="flex items-end gap-3 flex-wrap mb-4">
        <div className="w-52">
          <Input
            label="ID do dataset (pixel) *"
            placeholder="1234567890123456"
            inputMode="numeric"
            name="meta-dataset-id"
            autoComplete="off"
            value={datasetInput}
            onChange={(e) => setDatasetInput(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-56">
          <Input
            label={credentials?.hasCapiToken
              ? 'Token da CAPI (salvo — cole outro para trocar)'
              : 'Token da CAPI *'}
            type="password"
            placeholder={credentials?.hasCapiToken ? '•••••••• já salvo' : 'EAAxxxxx...'}
            name="meta-capi-token"
            autoComplete="new-password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Input
            label="Código de teste"
            placeholder="TEST12345"
            name="meta-capi-test"
            autoComplete="off"
            value={testeInput}
            onChange={(e) => setTesteInput(e.target.value)}
          />
        </div>
        <Button type="submit" loading={salvar.isPending}>
          {ligado ? 'Atualizar' : 'Ligar envio'}
        </Button>
        {ligado && (
          <button
            type="button"
            onClick={async () => {
              if (await confirm({
                title: 'Desligar API de Conversões',
                message: 'O CRM para de mandar evento pro Meta. O mapa das colunas fica salvo, então religar é só recolocar dataset e token.',
                confirmLabel: 'Desligar', danger: true,
              })) desligar.mutate()
            }}
            className="text-sm h-10 transition-colors"
            style={{ color: '#ff4444' }}
          >
            Desligar
          </button>
        )}
      </form>
      )}

      {erro && (
        <p className="text-sm rounded-lg px-3 py-2 mb-4"
          style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{erro}</p>
      )}

      {/* Codigo de teste esquecido ligado e pior que ausente: o Meta trata
          tudo como teste e nenhum evento conta pra campanha. Por isso o aviso
          e permanente e amarelo, nao uma nota discreta. */}
      {ligado && credentials?.capiTestCode && (
        <div className="rounded-lg px-3 py-2 mb-4 text-xs flex items-start gap-2"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            <strong>Modo de teste ligado.</strong> Os eventos aparecem na aba "Eventos de teste"
            do Meta na hora, mas <strong>não contam</strong> pra otimização da campanha. Apague o
            código de teste quando terminar de conferir.
          </span>
        </div>
      )}

      {/* ── Status do envio ───────────────────────────────────────────── */}
      {ligado && stats && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Pill icone={<Check size={12} />}   cor="#00e676" texto={`${stats.enviados} enviados`} />
          {stats.pendentes > 0 && (
            <>
              <Pill icone={<Clock size={12} />} cor="#fbbf24" texto={`${stats.pendentes} na fila`} />
              <button
                type="button"
                onClick={() => enviarAgora.mutate()}
                disabled={enviarAgora.isPending}
                title="O envio normal acontece de 5 em 5 minutos"
                className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 transition-colors disabled:opacity-50"
                style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676' }}
              >
                <Send size={11} />
                {enviarAgora.isPending ? 'Enviando…' : 'Enviar agora'}
              </button>
            </>
          )}
          {stats.falhados > 0 && (
            <Pill icone={<AlertTriangle size={12} />} cor="#ff4444" texto={`${stats.falhados} falharam`} />
          )}
        </div>
      )}

      {ligado && stats?.ultimoErro && (
        <div className="rounded-lg px-3 py-2 mb-4 text-xs"
          style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}>
          <p className="font-medium mb-1" style={{ color: '#ff6666' }}>O Meta recusou o último envio:</p>
          <p className="font-mono leading-relaxed break-all mb-2" style={{ color: '#aa7777' }}>
            {stats.ultimoErro}
          </p>
          <button
            type="button"
            onClick={() => retentar.mutate()}
            disabled={retentar.isPending}
            className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,68,68,0.12)', color: '#ff8888' }}
          >
            <RefreshCw size={11} className={retentar.isPending ? 'animate-spin' : undefined} />
            {retentar.isPending ? 'Reenfileirando…' : 'Corrigi — tentar de novo'}
          </button>
          <p className="mt-1.5" style={{ color: '#7a5555' }}>
            Salvar credencial nova já faz isso sozinho. Use o botão quando a falha foi do lado
            do Meta e não teve nada pra corrigir aqui.
          </p>
        </div>
      )}

      {/* ── Mapa coluna → evento ──────────────────────────────────────── */}
      {ligado && (
        <div style={{ borderTop: '1px solid #1e1e1e' }} className="pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#666' }}>
            O que cada coluna significa ({totalMapeado} marcadas)
          </p>
          <p className="text-[11px] mb-3 leading-relaxed" style={{ color: '#555' }}>
            Coluna sem evento não manda nada — e é assim que deve ser pra "perdido" e
            "no-show": o Meta não aprende com evento negativo, o sinal de lead ruim é
            justamente a ausência.
          </p>

          {funisLoading ? (
            <div className="flex justify-center py-6"><Spinner size="md" /></div>
          ) : (
            <div className="flex flex-col gap-2">
              {funis.map((funil) => {
                const marcadas = funil.stages.filter((st) => st.meta_event).length
                const aberto   = funilAberto(funil.pipelineId)
                return (
                <div key={funil.pipelineId} className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid #1e1e1e' }}>
                  {/* O resumo no cabeçalho é o que permite deixar tudo fechado:
                      dá pra ver qual funil ainda não foi configurado sem abrir
                      um por um. */}
                  <button type="button"
                    onClick={() => setFunisAbertos((a) => ({ ...a, [funil.pipelineId]: !aberto }))}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors"
                    style={{ background: '#171717' }}>
                    <span className="text-[11px] font-medium truncate" style={{ color: '#aaa' }}>
                      {funil.pipelineName}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] rounded-full px-2 py-0.5" style={{
                        background: marcadas ? 'rgba(0,230,118,0.1)' : '#1a1a1a',
                        color:      marcadas ? '#00e676' : '#555',
                      }}>
                        {marcadas
                          ? `${marcadas} de ${funil.stages.length} marcadas`
                          : 'nenhuma marcada'}
                      </span>
                      <ChevronDown size={13} style={{
                        color: '#555',
                        transform: aberto ? 'rotate(180deg)' : 'none',
                        transition: 'transform .15s',
                      }} />
                    </span>
                  </button>

                  {aberto && (
                  <div className="flex flex-col gap-1 p-2">
                    {funil.stages.map((stage) => (
                      <div key={stage.id}
                        className="flex items-center gap-3 px-3 py-1.5 rounded-lg"
                        style={{ border: '1px solid #1e1e1e' }}>
                        <span className="flex-1 text-xs truncate"
                          style={{ color: stage.meta_event ? '#e8e8e8' : '#777' }}>
                          {stage.name}
                        </span>
                        {salvou === stage.id && (
                          <span className="flex items-center gap-1 text-[10px] shrink-0"
                            style={{ color: '#00e676' }}>
                            <Check size={11} /> salvo
                          </span>
                        )}
                        <SeletorEvento
                          valor={stage.meta_event}
                          onChange={(event) => mapear.mutate({ stageId: stage.id, event })}
                        />
                      </div>
                    ))}
                  </div>
                  )}
                </div>
                )
              })}
            </div>
          )}

          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: '#555' }}>
            Cada evento sai <strong>uma vez por lead</strong>: arrastar o card de volta e
            de novo não conta duas vezes. O envio acontece em até 5 minutos.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Escolha do evento da coluna: os três padrão, ou um nome próprio.
 *
 * O nome próprio existe porque o pixel da empresa pode já receber evento com
 * o mesmo sentido de outra origem — o Calendly manda um "agendou", o
 * formulário manda um "lead". Sem poder renomear, o evento do comercial
 * viraria mais uma linha idêntica e ninguém saberia qual é qual.
 */
function SeletorEvento({ valor, onChange }: {
  valor:    string | null
  onChange: (event: string | null) => void
}) {
  const personalizado = isEventoPersonalizado(valor)
  const [editando, setEditando] = useState(personalizado)
  const [texto,    setTexto]    = useState(valor ?? '')
  const [erro,     setErro]     = useState(false)

  function confirmar() {
    const nome = texto.trim()
    if (!nome) { setErro(false); setEditando(false); onChange(null); return }
    if (!META_EVENT_REGEX.test(nome)) { setErro(true); return }
    setErro(false)
    onChange(nome)
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          value={texto}
          autoFocus
          placeholder="AgendouCRM"
          onChange={(e) => { setTexto(e.target.value); setErro(false) }}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.currentTarget.blur() }
            if (e.key === 'Escape') { setTexto(valor ?? ''); setErro(false); setEditando(personalizado) }
          }}
          className="text-xs rounded-lg px-2 py-1 outline-none w-36"
          style={{
            background: '#1a1a1a',
            border: `1px solid ${erro ? '#ff4444' : '#2f6f4f'}`,
            color: '#00e676',
          }}
          title="Letras, números, _ e - . Sem espaço e sem acento."
        />
        <button
          type="button"
          onClick={() => { setTexto(''); setErro(false); setEditando(false); onChange(null) }}
          className="text-[10px] transition-colors"
          style={{ color: '#555' }}
          title="Voltar para os eventos padrão"
        >
          padrão
        </button>
      </div>
    )
  }

  return (
    <select
      value={valor ?? ''}
      onChange={(e) => {
        if (e.target.value === '__custom__') { setTexto(''); setEditando(true); return }
        onChange(e.target.value || null)
      }}
      className="text-xs rounded-lg px-2 py-1 outline-none shrink-0"
      style={{
        background: '#1a1a1a',
        border: `1px solid ${valor ? '#2f6f4f' : '#252525'}`,
        color: valor ? '#00e676' : '#666',
      }}
    >
      <option value="">não manda nada</option>
      {META_EVENTS.map((ev) => (
        <option key={ev.value} value={ev.value}>{ev.label}</option>
      ))}
      <option value="__custom__">nome próprio…</option>
    </select>
  )
}

function Pill({ icone, cor, texto }: { icone: React.ReactNode; cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1"
      style={{ background: '#1a1a1a', color: cor }}>
      {icone}{texto}
    </span>
  )
}
