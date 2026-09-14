import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlignLeft, CheckSquare, MessageSquare, Users, Tag, CalendarClock, Palette, UserRound,
  ArrowRightLeft, Archive, Trash2, Plus, X, Check, ExternalLink, Pencil, Search,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime } from '@/lib/utils'
import {
  updateCard, deleteCard, setAssignee, setCardLabel, createLabel, updateLabel, deleteLabel,
  addChecklistItem, updateChecklistItem, deleteChecklistItem, addComment, deleteComment, searchLeads,
  CORES_QUADRO, type BoardFull, type CardData, type Membro,
} from '@/services/boards'
import { useCardDetail, useRecarregaQuadro } from '../hooks/useBoards'
import { Linkify, Avatar, Swatches, nomeDoMembro, hojeLocal } from './comum'

interface Props {
  card:       CardData | null
  data:       BoardFull
  membros:    Membro[]
  onClose:    () => void
  onOpenLead: (leadId: string) => void
}

/**
 * O cartão aberto. Esquerda: título, descrição (links clicáveis), checklist,
 * comentários. Direita: responsáveis, etiquetas, prazo, cor, lead, mover,
 * arquivar/excluir. Cada mexida grava na hora — sem botão "salvar" geral,
 * como no Trello.
 */
export function CardModal({ card, data, membros, onClose, onOpenLead }: Props) {
  const confirm     = useConfirm()
  const recarregar  = useRecarregaQuadro(data.board.id)
  const meuId       = useAuthStore((s) => s.user?.id)
  const { data: detalhe } = useCardDetail(card?.id ?? null)

  const [titulo,     setTitulo]     = useState('')
  const [editTitulo, setEditTitulo] = useState(false)
  const [descricao,  setDescricao]  = useState('')
  const [editDesc,   setEditDesc]   = useState(false)
  const [novoItem,   setNovoItem]   = useState('')
  const [comentario, setComentario] = useState('')
  const [painel,     setPainel]     = useState<'membros' | 'etiquetas' | 'lead' | null>(null)
  const [erro,       setErro]       = useState<string | null>(null)

  useEffect(() => {
    if (!card) return
    setTitulo(card.title); setDescricao(card.description ?? '')
    setEditTitulo(false); setEditDesc(false); setPainel(null); setErro(null)
  }, [card?.id, card?.title, card?.description]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return null

  const grava = async (fn: () => Promise<unknown>) => {
    setErro(null)
    try { await fn(); recarregar(card.id) }
    catch (e) { setErro((e as Error).message) }
  }

  const coluna     = data.columns.find((c) => c.id === card.column_id)
  const concluido  = !!card.completed_at
  const hoje       = hojeLocal()
  const atrasado   = !concluido && !!card.due_date && card.due_date < hoje
  const checklist  = detalhe?.checklist ?? []
  const feitos     = checklist.filter((i) => i.done).length
  const etiquetas  = data.labels.filter((l) => card.labelIds.includes(l.id))

  async function salvarTitulo() {
    setEditTitulo(false)
    const t = titulo.trim()
    if (!t || t === card!.title) { setTitulo(card!.title); return }
    await grava(() => updateCard(card!.id, { title: t }))
  }

  async function salvarDescricao() {
    setEditDesc(false)
    const d = descricao.trim()
    if (d === (card!.description ?? '')) return
    await grava(() => updateCard(card!.id, { description: d || null }))
  }

  async function adicionarItem() {
    const t = novoItem.trim()
    if (!t) return
    setNovoItem('')
    await grava(() => addChecklistItem(card!, t, checklist.length))
  }

  async function enviarComentario() {
    const b = comentario.trim()
    if (!b) return
    setComentario('')
    await grava(() => addComment(card!, b))
  }

  async function arquivar() {
    await grava(() => updateCard(card!.id, { archived_at: new Date().toISOString() }))
    onClose()
  }

  async function excluir() {
    const ok = await confirm({ title: 'Excluir cartão', message: `Excluir "${card!.title}" de vez? Checklist e comentários vão junto.`, confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    await grava(() => deleteCard(card!.id))
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="xl" title={data.board.name} description={`${coluna?.name ?? ''}${concluido ? ' · concluído' : ''}`}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_15rem] gap-6">
        {/* ── Coluna principal ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Título */}
          <div className="flex items-start gap-2">
            {card.color && <span className="mt-1.5 h-4 w-1.5 rounded-full shrink-0" style={{ background: card.color }} />}
            {editTitulo ? (
              <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={salvarTitulo}
                onKeyDown={(e) => { if (e.key === 'Enter') salvarTitulo(); if (e.key === 'Escape') { setTitulo(card.title); setEditTitulo(false) } }}
                className="flex-1 text-lg font-semibold rounded-md px-2 py-1 outline-none"
                style={{ background: '#161616', color: '#e8e8e8', border: '1px solid #333' }} />
            ) : (
              <button onClick={() => setEditTitulo(true)} className="flex-1 text-left text-lg font-semibold rounded-md px-2 py-1 -mx-2 hover:bg-[#161616]"
                style={{ color: concluido ? '#777' : '#e8e8e8', textDecoration: concluido ? 'line-through' : 'none' }} title="Clique para editar">
                {card.title}
              </button>
            )}
          </div>

          {/* Resumo rápido (etiquetas, prazo, responsáveis) */}
          {(etiquetas.length > 0 || card.due_date || card.assignees.length > 0) && (
            <div className="flex flex-wrap gap-x-5 gap-y-3 -mt-3">
              {etiquetas.length > 0 && (
                <Bloco titulo="Etiquetas">
                  <div className="flex flex-wrap gap-1">
                    {etiquetas.map((l) => <span key={l.id} className="text-xs font-medium rounded px-2 py-0.5" style={{ background: `${l.color}26`, color: l.color }}>{l.name}</span>)}
                  </div>
                </Bloco>
              )}
              {card.due_date && (
                <Bloco titulo="Prazo">
                  <span className="text-xs font-medium rounded px-2 py-0.5 inline-flex items-center gap-1"
                    style={atrasado ? { background: 'rgba(255,68,68,0.12)', color: '#ff4444' } : concluido ? { background: 'rgba(0,230,118,0.10)', color: '#00e676' } : { background: '#1e1e1e', color: '#ccc' }}>
                    <CalendarClock size={12} /> {card.due_date.split('-').reverse().join('/')} {atrasado && '· atrasado'}
                  </span>
                </Bloco>
              )}
              {card.assignees.length > 0 && (
                <Bloco titulo="Responsáveis">
                  <div className="flex -space-x-1.5">
                    {card.assignees.map((uid) => <Avatar key={uid} id={uid} membro={membros.find((m) => m.user_id === uid)} size={26} />)}
                  </div>
                </Bloco>
              )}
            </div>
          )}

          {/* Descrição */}
          <Secao icon={AlignLeft} titulo="Descrição"
            acao={!editDesc && card.description ? <BotaoMini onClick={() => setEditDesc(true)}><Pencil size={11} /> Editar</BotaoMini> : null}>
            {editDesc ? (
              <div className="flex flex-col gap-2">
                <textarea autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5}
                  placeholder="Detalhes, contexto, links… (links ficam clicáveis sozinhos)"
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y"
                  style={{ background: '#161616', color: '#e8e8e8', border: '1px solid #333' }} />
                <div className="flex gap-1.5">
                  <BotaoPrimario onClick={salvarDescricao}>Salvar</BotaoPrimario>
                  <BotaoMini onClick={() => { setDescricao(card.description ?? ''); setEditDesc(false) }}>Cancelar</BotaoMini>
                </div>
              </div>
            ) : card.description ? (
              <div className="text-sm leading-relaxed rounded-lg px-3 py-2 cursor-text" style={{ color: '#ccc', background: '#121212' }} onClick={() => setEditDesc(true)}>
                <Linkify text={card.description} />
              </div>
            ) : (
              <button onClick={() => setEditDesc(true)} className="w-full text-left text-sm rounded-lg px-3 py-2.5 hover:bg-[#161616]"
                style={{ color: '#555', background: '#121212' }}>Adicionar descrição…</button>
            )}
          </Secao>

          {/* Checklist */}
          <Secao icon={CheckSquare} titulo="Checklist" acao={checklist.length > 0 ? <span className="text-xs tabular-nums" style={{ color: feitos === checklist.length ? '#00e676' : '#666' }}>{feitos}/{checklist.length}</span> : null}>
            {checklist.length > 0 && (
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#1e1e1e' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(feitos / checklist.length) * 100}%`, background: feitos === checklist.length ? '#00e676' : 'var(--tenant-primary)' }} />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {checklist.map((item) => (
                <div key={item.id} className="group flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-[#161616]">
                  <button onClick={() => grava(() => updateChecklistItem(item.id, { done: !item.done }))}
                    className="mt-0.5 h-4 w-4 rounded shrink-0 flex items-center justify-center"
                    style={{ border: `1px solid ${item.done ? '#00e676' : '#444'}`, background: item.done ? 'rgba(0,230,118,0.15)' : 'transparent', color: '#00e676' }}>
                    {item.done && <Check size={11} />}
                  </button>
                  <span className="flex-1 text-sm" style={{ color: item.done ? '#666' : '#ddd', textDecoration: item.done ? 'line-through' : 'none' }}>
                    <Linkify text={item.text} />
                  </span>
                  <button onClick={() => grava(() => deleteChecklistItem(item.id))} className="opacity-0 group-hover:opacity-100 shrink-0" style={{ color: '#555' }} title="Remover"><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') adicionarItem() }}
                placeholder="Adicionar item…" className="flex-1 text-sm rounded-lg px-3 py-1.5 outline-none"
                style={{ background: '#161616', color: '#e8e8e8', border: '1px solid #2a2a2a' }} />
              <BotaoMini onClick={adicionarItem}><Plus size={12} /> Item</BotaoMini>
            </div>
          </Secao>

          {/* Comentários */}
          <Secao icon={MessageSquare} titulo="Comentários">
            <div className="flex flex-col gap-3">
              {(detalhe?.comments ?? []).map((c) => (
                <div key={c.id} className="group flex gap-2">
                  <Avatar id={c.user_id} membro={membros.find((m) => m.user_id === c.user_id)} size={26} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold" style={{ color: '#ddd' }}>{c.authorName}</span>
                      <span className="text-[10px]" style={{ color: '#555' }}>{formatDateTime(c.created_at)}</span>
                      {c.user_id === meuId && (
                        <button onClick={() => grava(() => deleteComment(c.id))} className="ml-auto opacity-0 group-hover:opacity-100 text-[10px]" style={{ color: '#666' }}>apagar</button>
                      )}
                    </div>
                    <div className="text-sm rounded-lg px-3 py-2 mt-1" style={{ background: '#161616', color: '#ccc' }}><Linkify text={c.body} /></div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                {meuId && <Avatar id={meuId} membro={membros.find((m) => m.user_id === meuId)} size={26} />}
                <div className="flex-1 flex flex-col gap-1.5">
                  <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviarComentario() }}
                    placeholder="Escreva um comentário… (Ctrl+Enter envia)"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                    style={{ background: '#161616', color: '#e8e8e8', border: '1px solid #2a2a2a' }} />
                  {comentario.trim() && <div><BotaoPrimario onClick={enviarComentario}>Comentar</BotaoPrimario></div>}
                </div>
              </div>
            </div>
          </Secao>

          {erro && <p className="text-xs" style={{ color: '#ff4444' }}>{erro}</p>}
        </div>

        {/* ── Barra lateral ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Lateral icon={Users} titulo="Responsáveis" onToggle={() => setPainel(painel === 'membros' ? null : 'membros')} aberto={painel === 'membros'}>
            {card.assignees.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {card.assignees.map((uid) => {
                  const m = membros.find((x) => x.user_id === uid)
                  return (
                    <span key={uid} className="inline-flex items-center gap-1 text-xs rounded-full pl-0.5 pr-2 py-0.5" style={{ background: '#1a1a1a', color: '#ccc' }}>
                      <Avatar id={uid} membro={m} size={18} /> {nomeDoMembro(m).split(' ')[0]}
                    </span>
                  )
                })}
              </div>
            )}
            {painel === 'membros' && (
              <Painel>
                {membros.map((m) => {
                  const on = card.assignees.includes(m.user_id)
                  return (
                    <button key={m.user_id} onClick={() => grava(() => setAssignee(card, m.user_id, !on))}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#1e1e1e]">
                      <Avatar id={m.user_id} membro={m} size={22} />
                      <span className="flex-1 text-xs truncate" style={{ color: '#ddd' }}>{nomeDoMembro(m)}</span>
                      {on && <Check size={13} style={{ color: '#00e676' }} />}
                    </button>
                  )
                })}
              </Painel>
            )}
          </Lateral>

          <Lateral icon={Tag} titulo="Etiquetas" onToggle={() => setPainel(painel === 'etiquetas' ? null : 'etiquetas')} aberto={painel === 'etiquetas'}>
            {painel === 'etiquetas' && (
              <Painel>
                <GerenciarEtiquetas card={card} data={data} grava={grava} />
              </Painel>
            )}
          </Lateral>

          <div>
            <RotuloLateral icon={CalendarClock}>Prazo</RotuloLateral>
            <DatePicker value={card.due_date ?? ''} onChange={(v) => grava(() => updateCard(card.id, { due_date: v || null }))} placeholder="Sem prazo" />
          </div>

          <div>
            <RotuloLateral icon={Palette}>Cor</RotuloLateral>
            <Swatches value={card.color} onChange={(c) => grava(() => updateCard(card.id, { color: c }))} />
          </div>

          <Lateral icon={UserRound} titulo="Lead" onToggle={() => setPainel(painel === 'lead' ? null : 'lead')} aberto={painel === 'lead'}>
            {card.lead_id && (
              <div className="flex items-center gap-1 text-xs rounded-lg px-2 py-1.5 mb-1" style={{ background: '#1a1a1a' }}>
                <button onClick={() => onOpenLead(card.lead_id!)} className="flex-1 min-w-0 flex items-center gap-1.5 text-left hover:underline" style={{ color: '#40a0ff' }}>
                  <span className="truncate">{card.leadName ?? 'Lead'}</span> <ExternalLink size={11} className="shrink-0" />
                </button>
                <button onClick={() => grava(() => updateCard(card.id, { lead_id: null }))} title="Desligar do lead" style={{ color: '#666' }}><X size={13} /></button>
              </div>
            )}
            {painel === 'lead' && (
              <Painel>
                <BuscaLead tenantId={data.board.tenant_id} onPick={(id) => { setPainel(null); grava(() => updateCard(card.id, { lead_id: id })) }} />
              </Painel>
            )}
          </Lateral>

          <div>
            <RotuloLateral icon={ArrowRightLeft}>Mover para</RotuloLateral>
            <Select value={card.column_id} onChange={(e) => grava(() => updateCard(card.id, { column_id: e.target.value, position: 1e9 }))}
              options={data.columns.map((c) => ({ value: c.id, label: c.name + (c.is_done ? ' ✓' : '') }))} />
          </div>

          <div className="flex flex-col gap-1 pt-2" style={{ borderTop: '1px solid #1e1e1e' }}>
            <button onClick={arquivar} className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5 hover:bg-[#1e1e1e]" style={{ color: '#999' }}><Archive size={13} /> Arquivar</button>
            <button onClick={excluir}  className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5 hover:bg-[#1e1e1e]" style={{ color: '#ff4444' }}><Trash2 size={13} /> Excluir</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Etiquetas do quadro: marcar no cartão, criar, renomear, apagar ──────────
function GerenciarEtiquetas({ card, data, grava }: { card: CardData; data: BoardFull; grava: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [nova,     setNova]     = useState('')
  const [cor,      setCor]      = useState(CORES_QUADRO[0])
  const [editando, setEditando] = useState<string | null>(null)
  const [nome,     setNome]     = useState('')

  async function criar() {
    const n = nova.trim(); if (!n) return
    setNova('')
    await grava(async () => { const id = await createLabel(data.board, n, cor); await setCardLabel(card, id, true) })
  }

  return (
    <div className="flex flex-col gap-1">
      {data.labels.map((l) => {
        const on = card.labelIds.includes(l.id)
        return editando === l.id ? (
          <div key={l.id} className="flex flex-col gap-1.5 rounded-md p-1.5" style={{ background: '#1a1a1a' }}>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { grava(() => updateLabel(l.id, { name: nome.trim() || l.name })); setEditando(null) } if (e.key === 'Escape') setEditando(null) }}
              className="text-xs rounded px-2 py-1 outline-none" style={{ background: '#111', color: '#e8e8e8', border: '1px solid #333' }} />
            <Swatches value={l.color} allowNone={false} size={18} onChange={(c) => grava(() => updateLabel(l.id, { color: c! }))} />
            <div className="flex gap-1">
              <BotaoMini onClick={() => { grava(() => updateLabel(l.id, { name: nome.trim() || l.name })); setEditando(null) }}>Salvar</BotaoMini>
              <BotaoMini onClick={() => { grava(() => deleteLabel(l.id)); setEditando(null) }} danger><Trash2 size={11} /> Apagar do quadro</BotaoMini>
            </div>
          </div>
        ) : (
          <div key={l.id} className="group flex items-center gap-1">
            <button onClick={() => grava(() => setCardLabel(card, l.id, !on))}
              className="flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:opacity-90"
              style={{ background: `${l.color}26`, color: l.color }}>
              <span className="flex-1 text-xs font-medium truncate">{l.name}</span>
              {on && <Check size={13} />}
            </button>
            <button onClick={() => { setEditando(l.id); setNome(l.name) }} className="opacity-0 group-hover:opacity-100 p-1" style={{ color: '#666' }} title="Editar etiqueta"><Pencil size={11} /></button>
          </div>
        )
      })}
      <div className="flex flex-col gap-1.5 mt-1 pt-2" style={{ borderTop: '1px solid #242424' }}>
        <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') criar() }}
          placeholder="Nova etiqueta…" className="text-xs rounded px-2 py-1.5 outline-none" style={{ background: '#111', color: '#e8e8e8', border: '1px solid #2a2a2a' }} />
        <div className="flex items-center gap-2">
          <Swatches value={cor} allowNone={false} size={16} onChange={(c) => setCor(c!)} />
          <BotaoMini onClick={criar}><Plus size={11} /> Criar</BotaoMini>
        </div>
      </div>
    </div>
  )
}

// ── Busca de lead ───────────────────────────────────────────────────────────
function BuscaLead({ tenantId, onPick }: { tenantId: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [qDeb, setQDeb] = useState('')
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setQDeb(q), 250) }, [q])
  const { data: leads = [], isLoading } = useQuery({ queryKey: ['busca-lead', tenantId, qDeb], queryFn: () => searchLeads(tenantId, qDeb) })
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 rounded px-2 py-1.5" style={{ background: '#111', border: '1px solid #2a2a2a' }}>
        <Search size={12} style={{ color: '#666' }} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lead pelo nome…" className="flex-1 text-xs outline-none bg-transparent" style={{ color: '#e8e8e8' }} />
      </div>
      <div className="max-h-48 overflow-y-auto flex flex-col">
        {isLoading && <span className="text-[11px] px-2 py-1" style={{ color: '#555' }}>Buscando…</span>}
        {!isLoading && leads.length === 0 && <span className="text-[11px] px-2 py-1" style={{ color: '#555' }}>Nenhum lead com esse nome</span>}
        {leads.map((l) => (
          <button key={l.id} onClick={() => onPick(l.id)} className="text-left rounded px-2 py-1.5 hover:bg-[#1e1e1e]">
            <span className="block text-xs truncate" style={{ color: '#ddd' }}>{l.name}</span>
            {l.company_name && <span className="block text-[10px] truncate" style={{ color: '#666' }}>{l.company_name}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Pedaços de layout ───────────────────────────────────────────────────────
function Secao({ icon: Icon, titulo, acao, children }: { icon: React.ElementType; titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color: '#888' }} />
        <h4 className="text-sm font-semibold flex-1" style={{ color: '#e8e8e8' }}>{titulo}</h4>
        {acao}
      </div>
      <div className="pl-[23px]">{children}</div>
    </section>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: '#555' }}>{titulo}</p>
      {children}
    </div>
  )
}

function RotuloLateral({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: '#666' }}><Icon size={12} /> {children}</p>
}

function Lateral({ icon, titulo, aberto, onToggle, children }: { icon: React.ElementType; titulo: string; aberto: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <RotuloLateral icon={icon}>{titulo}</RotuloLateral>
        <button onClick={onToggle} className="h-6 w-6 -mt-1.5 rounded-md flex items-center justify-center hover:bg-[#1e1e1e]" style={{ color: aberto ? '#e8e8e8' : '#666' }} title={aberto ? 'Fechar' : 'Alterar'}>
          {aberto ? <X size={13} /> : <Plus size={13} />}
        </button>
      </div>
      {children}
    </div>
  )
}

function Painel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg p-1.5 mt-1" style={{ background: '#141414', border: '1px solid #242424' }}>{children}</div>
}

function BotaoMini({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-1 hover:bg-[#1e1e1e]" style={{ color: danger ? '#ff4444' : '#999' }}>
      {children}
    </button>
  )
}

function BotaoPrimario({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="text-xs font-semibold rounded-md px-3 py-1.5" style={{ background: 'var(--tenant-primary)', color: '#000' }}>{children}</button>
}
