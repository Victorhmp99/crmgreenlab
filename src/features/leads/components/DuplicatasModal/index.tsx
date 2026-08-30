import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScanSearch, Check, Merge, AlertTriangle, FileText, Activity } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/store/authStore'
import { buscarDuplicatas, mesclarLeads, type GrupoDuplicado } from '@/services/duplicatas'

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

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ['leads-duplicados', tenantId],
    queryFn:  () => buscarDuplicatas(tenantId!),
    enabled:  !!tenantId && open,
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
      description="Mesma pessoa cadastrada mais de uma vez — casados pelo final do telefone">

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner size="md" /></div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ScanSearch size={24} style={{ color: '#2f6f4f' }} />
          <p className="text-sm" style={{ color: '#888' }}>Nenhum lead repetido nesta empresa.</p>
          <p className="text-xs" style={{ color: '#555' }}>
            A comparação usa os 8 últimos dígitos do telefone, então o nono dígito e a
            formatação não atrapalham.
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
                  <span className="text-xs" style={{ color: '#888' }}>
                    {grupo.leads[0].telefone}
                    <span style={{ color: '#555' }}> · {grupo.leads.length} cadastros</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => confirmarJuncao(grupo)}
                    disabled={juntar.isPending}
                    className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                    style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}
                  >
                    <Merge size={12} /> Juntar
                  </button>
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
