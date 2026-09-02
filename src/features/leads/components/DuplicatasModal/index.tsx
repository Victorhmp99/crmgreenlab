import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScanSearch, Check, Merge, AlertTriangle, FileText, Activity, Trash2, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/store/authStore'
import {
  buscarDuplicatas, mesclarLeads, buscarLeadsSemContato, excluirLeadsSemContato,
  ignorarGrupo, excluirLeadDuplicado, type GrupoDuplicado,
} from '@/services/duplicatas'

/**
 * Leads repetidos da empresa.
 *
 * Duplicata custa de três formas: dois vendedores ligam pra mesma pessoa, o
 * histórico fica partido em dois cards, e a API de Conversões pode contar a
 * mesma venda duas vezes — ensinando errado a campanha.
 *
 * A tela mostra o que é preciso pra escolher qual fica sem abrir os dois:
 * quando entrou, em que etapa está, de quem é, e quanto histórico carrega.
 */
export function DuplicatasModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tenantId    = useAuthStore((s) => s.tenant?.id)
  const queryClient = useQueryClient()
  const confirm     = useConfirm()

  // Qual lead fica, por grupo. Sem escolha, vale o primeiro — que o banco já
  // devolve como o mais antigo, normalmente o que tem o histórico.
  const [mantidos, setMantidos] = useState<Record<string, string>>({})
  const [erro,     setErro]     = useState<string | null>(null)
  const [aba,      setAba]      = useState<'repetidos' | 'lixo'>('repetidos')
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ['leads-duplicados', tenantId],
    queryFn:  () => buscarDuplicatas(tenantId!),
    enabled:  !!tenantId && open,
  })

  const { data: semContato = [] } = useQuery({
    queryKey: ['leads-sem-contato', tenantId],
    queryFn:  () => buscarLeadsSemContato(tenantId!),
    enabled:  !!tenantId && open,
  })

  const apagarLixo = useMutation({
    mutationFn: (ids: string[]) => excluirLeadsSemContato(tenantId!, ids),
    onSuccess: (r) => {
      setMarcados({})
      setErro(r.preservados > 0
        // Recusa é informação, não falha: o banco se nega a apagar lead com
        // contrato, e a pessoa precisa saber por que alguns ficaram.
        ? `${r.apagados} apagados. ${r.preservados} preservados por terem contrato ou lançamento financeiro.`
        : null)
      queryClient.invalidateQueries({ queryKey: ['leads-sem-contato', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  /* "Não é duplicata" é tão necessário quanto "juntar": o casamento por nome
     acerta o Ricardo repetido, mas também encontra dois Maria Silva
     diferentes. Sem poder dispensar, o falso positivo voltaria pra sempre e a
     tela deixaria de ser olhada. */
  const dispensar = useMutation({
    mutationFn: (chave: string) => ignorarGrupo(tenantId!, chave),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads-duplicados', tenantId] }),
    onError:   (e: Error) => setErro(e.message),
  })

  const apagarUm = useMutation({
    mutationFn: (leadId: string) => excluirLeadDuplicado(tenantId!, leadId),
    onSuccess: () => {
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['leads-duplicados', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError:   (e: Error) => setErro(e.message),
  })

  const juntar = useMutation({
    mutationFn: async ({ manter, remover }: { manter: string; remover: string[] }) => {
      // Um de cada vez: se um falhar, os anteriores já valeram e o erro diz
      // qual parou. Mandar tudo junto deixaria a base num meio-termo silencioso.
      for (const id of remover) await mesclarLeads(tenantId!, manter, id)
    },
    onSuccess: () => {
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['leads-duplicados', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  async function confirmarJuncao(grupo: GrupoDuplicado) {
    const manter  = mantidos[grupo.chave] ?? grupo.leads[0].leadId
    const remover = grupo.leads.filter((l) => l.leadId !== manter).map((l) => l.leadId)
    if (!remover.length) return

    const ficou = grupo.leads.find((l) => l.leadId === manter)
    const ok = await confirm({
      title:   `Juntar ${remover.length + 1} leads num só`,
      message: `Fica: ${ficou?.nome || 'sem nome'}.\n\n`
             + 'Contratos, financeiro, atividades, tarefas e etiquetas dos outros são movidos '
             + 'pra ele antes de sumirem. Nada de histórico se perde — mas os cards repetidos '
             + 'saem do funil, e isso não tem como desfazer.',
      confirmLabel: 'Juntar',
      danger: true,
    })
    if (ok) juntar.mutate({ manter, remover })
  }

  return (
    <Modal open={open} onClose={onClose} size="xl"
      title="Leads repetidos"
      description="Mesma pessoa cadastrada mais de uma vez, e cadastros sem forma de contato">

      <div className="flex items-center gap-1 mb-4">
        {([
          ['repetidos', `Repetidos${grupos.length ? ` (${grupos.length})` : ''}`],
          ['lixo',      `Sem contato${semContato.length ? ` (${semContato.length})` : ''}`],
        ] as const).map(([valor, rotulo]) => (
          <button key={valor} type="button" onClick={() => { setAba(valor); setErro(null) }}
            className="text-xs rounded-lg px-3 py-1.5 transition-colors"
            style={{
              background: aba === valor ? '#1f1f1f' : 'transparent',
              color:      aba === valor ? '#e8e8e8' : '#666',
              border:     `1px solid ${aba === valor ? '#2c2c2c' : 'transparent'}`,
            }}>
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'lixo' ? (
        <ListaSemContato
          leads={semContato}
          marcados={marcados}
          onMarcar={(id) => setMarcados((m) => ({ ...m, [id]: !m[id] }))}
          onApagar={async () => {
            const ids = Object.keys(marcados).filter((k) => marcados[k])
            if (!ids.length) return
            const ok = await confirm({
              title: `Excluir ${ids.length} lead(s) sem contato`,
              message: 'Não dá pra desfazer. Quem tiver contrato ou lançamento financeiro é preservado automaticamente — o banco recusa apagar dado de receita.',
              confirmLabel: 'Excluir', danger: true,
            })
            if (ok) apagarLixo.mutate(ids)
          }}
          apagando={apagarLixo.isPending}
          erro={erro}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-10"><Spinner size="md" /></div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ScanSearch size={24} style={{ color: '#2f6f4f' }} />
          <p className="text-sm" style={{ color: '#888' }}>Nenhum lead repetido nesta empresa.</p>
          <p className="text-xs" style={{ color: '#555' }}>
            A busca casa por telefone (8 últimos dígitos), e-mail ou nome completo — então
            pega também quem foi cadastrado duas vezes com só um dos dois preenchido.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs" style={{ color: '#666' }}>
            {grupos.length} {grupos.length === 1 ? 'pessoa aparece' : 'pessoas aparecem'} mais de
            uma vez. Escolha qual cadastro fica — o histórico dos outros é movido pra ele.
          </p>

          {erro && (
            <p className="text-sm rounded-lg px-3 py-2"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>{erro}</p>
          )}

          {grupos.map((grupo) => {
            const manter = mantidos[grupo.chave] ?? grupo.leads[0].leadId
            return (
              <div key={grupo.chave} className="rounded-xl overflow-hidden"
                style={{ border: '1px solid #1e1e1e' }}>
                <div className="flex items-center justify-between gap-3 px-3 py-2"
                  style={{ background: '#171717' }}>
                  <span className="text-xs truncate" style={{ color: '#888' }}>
                    {grupo.leads[0].nome || grupo.leads[0].telefone || 'sem nome'}
                    <span style={{ color: '#555' }}> · {grupo.motivo} · {grupo.leads.length} cadastros</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => dispensar.mutate(grupo.chave)}
                      disabled={dispensar.isPending}
                      title="Some da lista pra sempre — use quando forem pessoas diferentes"
                      className="flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
                      style={{ background: '#1a1a1a', color: '#777' }}
                    >
                      <X size={11} /> Não é duplicata
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmarJuncao(grupo)}
                      disabled={juntar.isPending}
                      className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}
                    >
                      <Merge size={12} /> Juntar
                    </button>
                  </span>
                </div>

                <div className="flex flex-col">
                  {grupo.leads.map((lead) => {
                    const fica = lead.leadId === manter
                    return (
                      <label key={lead.leadId}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                        style={{
                          borderTop: '1px solid #1a1a1a',
                          background: fica ? 'rgba(0,230,118,0.04)' : 'transparent',
                        }}>
                        <input
                          type="radio"
                          name={`manter-${grupo.chave}`}
                          checked={fica}
                          onChange={() => setMantidos((m) => ({ ...m, [grupo.chave]: lead.leadId }))}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" style={{ color: fica ? '#e8e8e8' : '#999' }}>
                            {lead.nome || 'sem nome'}
                            {fica && (
                              <span className="ml-2 text-[10px]" style={{ color: '#00e676' }}>
                                <Check size={10} className="inline" /> fica
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: '#555' }}>
                            {new Date(lead.criadoEm).toLocaleDateString('pt-BR')}
                            {lead.etapa       && ` · ${lead.etapa}`}
                            {lead.responsavel && ` · ${lead.responsavel}`}
                            {lead.email       && ` · ${lead.email}`}
                          </p>
                        </div>

                        {/* Contrato é o que pesa na decisão: juntar move o
                            dinheiro, mas ver antes evita escolher às cegas. */}
                        <span className="flex items-center gap-2 shrink-0 text-[10px]">
                          {/* Só no que NÃO fica: oferecer "apagar" no escolhido
                              seria convite pro engano. */}
                          {!fica && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault()
                                const ok = await confirm({
                                  title:   `Apagar ${lead.nome || 'este cadastro'}`,
                                  message: 'Some de vez, sem juntar nada. Se ele tiver contrato ou lançamento financeiro, o banco recusa — nesse caso use Juntar, que preserva o histórico.',
                                  confirmLabel: 'Apagar', danger: true,
                                })
                                if (ok) apagarUm.mutate(lead.leadId)
                              }}
                              disabled={apagarUm.isPending}
                              title="Apagar só este cadastro"
                              className="rounded p-1 transition-colors disabled:opacity-40"
                              style={{ color: '#7a5555' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                          {lead.contratos > 0 && (
                            <span className="flex items-center gap-1 rounded-full px-2 py-0.5"
                              title={`${lead.contratos} contrato(s) — vão junto pro cadastro que ficar`}
                              style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676' }}>
                              <FileText size={10} /> {lead.contratos}
                            </span>
                          )}
                          {lead.atividades > 0 && (
                            <span className="flex items-center gap-1 rounded-full px-2 py-0.5"
                              title={`${lead.atividades} atividade(s) no histórico`}
                              style={{ background: '#1a1a1a', color: '#777' }}>
                              <Activity size={10} /> {lead.atividades}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <p className="flex items-start gap-2 text-[11px]" style={{ color: '#7a6a45' }}>
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>
              Só o gestor junta leads, e a junção não tem como desfazer. Contratos e lançamentos
              financeiros são movidos — nunca apagados.
            </span>
          </p>
        </div>
      )}
    </Modal>
  )
}

/**
 * Cadastros sem telefone e sem e-mail.
 *
 * Não há como falar com eles: é lixo de base, quase sempre importação torta ou
 * formulário pela metade. A lista mostra contrato e atividade porque apagar
 * lead é CASCATA — e um lead sem telefone pode, ainda assim, ter contrato.
 * O banco recusa apagar esses; a coluna existe pra pessoa entender por quê.
 */
function ListaSemContato({ leads, marcados, onMarcar, onApagar, apagando, erro }: {
  leads:    Array<{ leadId: string; nome: string | null; criadoEm: string
                    origem: string | null; etapa: string | null
                    atividades: number; contratos: number }>
  marcados: Record<string, boolean>
  onMarcar: (id: string) => void
  onApagar: () => void
  apagando: boolean
  erro:     string | null
}) {
  const total = leads.filter((l) => marcados[l.leadId]).length

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <ScanSearch size={24} style={{ color: '#2f6f4f' }} />
        <p className="text-sm" style={{ color: '#888' }}>
          Nenhum lead sem telefone e sem e-mail.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <p className="text-sm rounded-lg px-3 py-2"
          style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.08)' }}>{erro}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: '#666' }}>
          {leads.length} cadastro(s) sem nenhuma forma de contato.
        </p>
        <button type="button" onClick={onApagar} disabled={!total || apagando}
          className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 transition-colors disabled:opacity-40"
          style={{ background: 'rgba(255,68,68,0.12)', color: '#ff6666' }}>
          <Trash2 size={12} /> {apagando ? 'Excluindo…' : `Excluir ${total || ''}`}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {leads.map((l) => (
          <label key={l.leadId}
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
            style={{ border: '1px solid #1e1e1e' }}>
            <input type="checkbox" checked={!!marcados[l.leadId]}
              onChange={() => onMarcar(l.leadId)} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate" style={{ color: '#ccc' }}>{l.nome || 'sem nome'}</p>
              <p className="text-[11px] truncate" style={{ color: '#555' }}>
                {new Date(l.criadoEm).toLocaleDateString('pt-BR')}
                {l.origem && ` · ${l.origem}`}
                {l.etapa  && ` · ${l.etapa}`}
              </p>
            </div>
            <span className="flex items-center gap-2 shrink-0 text-[10px]">
              {l.contratos > 0 && (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5"
                  title="Tem contrato — o banco não deixa apagar"
                  style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676' }}>
                  <FileText size={10} /> {l.contratos}
                </span>
              )}
              {l.atividades > 0 && (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ background: '#1a1a1a', color: '#777' }}>
                  <Activity size={10} /> {l.atividades}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
