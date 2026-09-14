import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, UserRound, Trash2, Pencil, Filter, X, Archive } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/authStore'
import { updateBoard, deleteBoard, type CardData } from '@/services/boards'
import { fetchLeadById } from '@/services/leads'
import { LeadDrawer } from '@/features/activities/components/LeadDrawer'
import type { Lead } from '@/types'
import { useBoard, useMembros, useRecarregaQuadro } from '../hooks/useBoards'
import { BoardKanban } from '../components/BoardKanban'
import { CardModal } from '../components/CardModal'
import { ArquivadosModal } from '../components/ArquivadosModal'
import { Swatches } from '../components/comum'

/**
 * Um quadro aberto: colunas, cartões, filtros (meus / etiqueta) e o cartão
 * em detalhe. `?cartao=<id>` na URL abre o cartão direto — é o link que o
 * sino manda.
 */
export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate    = useNavigate()
  const confirm     = useConfirm()
  const { isManager } = usePermissions()
  const meuId       = useAuthStore((s) => s.user?.id)
  const [params, setParams] = useSearchParams()

  const { data, isLoading, error } = useBoard(boardId ?? null)
  const { data: membros = [] }     = useMembros()
  const recarregar = useRecarregaQuadro(boardId ?? null)

  const [soMeus,     setSoMeus]     = useState(false)
  const [etiqueta,   setEtiqueta]   = useState<string | null>(null)
  const [editNome,   setEditNome]   = useState(false)
  const [nome,       setNome]       = useState('')
  const [corAberta,  setCorAberta]  = useState(false)
  const [leadAberto, setLeadAberto] = useState<Lead | null>(null)
  const [arquivados, setArquivados] = useState(false)

  const cartaoId = params.get('cartao')
  const cartao   = useMemo(() => data?.cards.find((c) => c.id === cartaoId) ?? null, [data, cartaoId])

  useEffect(() => { if (data) setNome(data.board.name) }, [data?.board.name]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirCartao(c: CardData | null) {
    const p = new URLSearchParams(params)
    if (c) p.set('cartao', c.id); else p.delete('cartao')
    setParams(p, { replace: true })
  }

  async function abrirLead(leadId: string) {
    try { setLeadAberto(await fetchLeadById(leadId)) } catch { /* lead apagado ou sem acesso */ }
  }

  async function salvarNome() {
    setEditNome(false)
    const n = nome.trim()
    if (!data || !n || n === data.board.name) { setNome(data?.board.name ?? ''); return }
    await updateBoard(data.board.id, { name: n }); recarregar()
  }

  async function excluirQuadro() {
    if (!data) return
    const ok = await confirm({
      title: 'Excluir quadro',
      message: `Excluir "${data.board.name}" apaga todas as colunas e cartões dele. Não dá pra desfazer.`,
      confirmLabel: 'Excluir quadro', danger: true,
    })
    if (!ok) return
    await deleteBoard(data.board.id)
    recarregar()
    navigate('/boards')
  }

  const cartoes = useMemo(() => {
    if (!data) return []
    return data.cards.filter((c) =>
      (!soMeus || (meuId && c.assignees.includes(meuId))) &&
      (!etiqueta || c.labelIds.includes(etiqueta)))
  }, [data, soMeus, etiqueta, meuId])

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="md" /></div>
  if (error || !data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <button onClick={() => navigate('/boards')} className="text-xs inline-flex items-center gap-1" style={{ color: '#888' }}><ArrowLeft size={13} /> Quadros</button>
        <p className="text-sm" style={{ color: '#ff4444' }}>{(error as Error)?.message ?? 'Quadro não encontrado.'}</p>
      </div>
    )
  }

  const filtrando = soMeus || !!etiqueta

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[70vh]">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate('/boards')} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#1a1a1a]" style={{ color: '#888' }} title="Todos os quadros">
          <ArrowLeft size={16} />
        </button>

        <div className="relative">
          <button onClick={() => setCorAberta((v) => !v)} className="h-5 w-5 rounded-md" style={{ background: data.board.color ?? '#2a2a2a' }} title="Cor do quadro" />
          {corAberta && (
            <div className="absolute left-0 top-7 z-30 rounded-lg p-2" style={{ background: '#161616', border: '1px solid #2a2a2a' }}>
              <Swatches value={data.board.color} size={22} onChange={async (c) => { setCorAberta(false); await updateBoard(data.board.id, { color: c }); recarregar() }} />
            </div>
          )}
        </div>

        {editNome ? (
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome}
            onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); if (e.key === 'Escape') { setNome(data.board.name); setEditNome(false) } }}
            className="text-xl font-semibold rounded-md px-2 py-0.5 outline-none" style={{ background: '#161616', color: '#e8e8e8', border: '1px solid #333' }} />
        ) : (
          <button onClick={() => setEditNome(true)} className="group inline-flex items-center gap-2 text-xl font-semibold rounded-md px-2 py-0.5 -ml-1 hover:bg-[#161616]" style={{ color: '#e8e8e8' }} title="Renomear">
            {data.board.name} <Pencil size={13} className="opacity-0 group-hover:opacity-100" style={{ color: '#666' }} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setSoMeus((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 transition-colors"
            style={soMeus ? { background: 'rgba(64,160,255,0.15)', color: '#40a0ff', border: '1px solid rgba(64,160,255,0.4)' } : { color: '#888', border: '1px solid #2a2a2a' }}>
            <UserRound size={13} /> Meus
          </button>

          {data.labels.length > 0 && (
            <div className="inline-flex items-center gap-1 text-xs rounded-lg px-2 py-1" style={{ border: '1px solid #2a2a2a' }}>
              <Filter size={12} style={{ color: '#666' }} />
              <select value={etiqueta ?? ''} onChange={(e) => setEtiqueta(e.target.value || null)}
                className="bg-transparent outline-none text-xs" style={{ color: etiqueta ? '#e8e8e8' : '#888' }}>
                <option value="">Todas as etiquetas</option>
                {data.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {filtrando && (
            <button onClick={() => { setSoMeus(false); setEtiqueta(null) }} className="inline-flex items-center gap-1 text-xs px-1.5 py-1.5" style={{ color: '#888' }}>
              <X size={12} /> limpar
            </button>
          )}

          <button onClick={() => setArquivados(true)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#1a1a1a]" style={{ color: '#888' }} title="Cartões arquivados">
            <Archive size={14} />
          </button>

          {isManager && (
            <button onClick={excluirQuadro} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#2a0a0a]" style={{ color: '#ff4444' }} title="Excluir quadro">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {filtrando && cartoes.length === 0 && (
        <p className="text-xs" style={{ color: '#666' }}>Nenhum cartão bate com o filtro.</p>
      )}

      <div className="flex-1 min-h-0">
        <BoardKanban data={data} cards={cartoes} membros={membros} onOpenCard={abrirCartao} />
      </div>

      <CardModal card={cartao} data={data} membros={membros} onClose={() => abrirCartao(null)} onOpenLead={abrirLead} />

      <ArquivadosModal open={arquivados} data={data} onClose={() => setArquivados(false)} />

      <LeadDrawer lead={leadAberto} onClose={() => setLeadAberto(null)} onEdit={() => { setLeadAberto(null); navigate('/leads') }} />
    </div>
  )
}
