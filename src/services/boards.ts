import { supabase } from '@/lib/supabase'
import type { Board, BoardColumn, BoardLabel, BoardCard, BoardChecklistItem, BoardComment } from '@/types'

/**
 * Quadros de tarefas (estilo Trello).
 *
 * Leitura vem em poucas consultas paralelas por quadro — cartões, responsáveis,
 * etiquetas, checklist — e o serviço monta o CardData que o quadro desenha.
 * Escrita é direta nas tabelas (RLS: membro da empresa); o banco cuida de
 * concluir pela coluna "Feito" e de avisar no sino.
 */

export interface BoardWithSummary extends Board {
  abertos:   number
  atrasados: number
  meus:      number
}

export interface CardData extends BoardCard {
  assignees:      string[]
  labelIds:       string[]
  checklistTotal: number
  checklistDone:  number
  commentCount:   number
  leadName:       string | null
}

export interface BoardFull {
  board:   Board
  columns: BoardColumn[]
  cards:   CardData[]
  labels:  BoardLabel[]
}

export interface Membro {
  user_id:   string
  full_name: string | null
  email:     string
  role:      string
}

export interface CommentWithAuthor extends BoardComment {
  authorName: string
}

export interface CardDetail {
  checklist: BoardChecklistItem[]
  comments:  CommentWithAuthor[]
}

export const CORES_QUADRO = ['#f472b6', '#fb923c', '#fbbf24', '#00e676', '#40a0ff', '#a78bfa', '#f87171', '#94a3b8']

function falha(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

// ── Quadros ─────────────────────────────────────────────────────────────────
export async function fetchBoards(tenantId: string): Promise<BoardWithSummary[]> {
  const [{ data: boards, error }, { data: resumo, error: e2 }] = await Promise.all([
    supabase.from('boards').select('*').eq('tenant_id', tenantId).is('archived_at', null).order('position'),
    supabase.rpc('resumo_dos_quadros', { p_tenant_id: tenantId }),
  ])
  falha(error); falha(e2)
  const porQuadro = new Map<string, { abertos: number; atrasados: number; meus: number }>()
  for (const r of (resumo ?? []) as Array<{ board_id: string; abertos: number; atrasados: number; meus: number }>) {
    porQuadro.set(r.board_id, r)
  }
  return ((boards ?? []) as Board[]).map((b) => ({
    ...b,
    abertos:   porQuadro.get(b.id)?.abertos   ?? 0,
    atrasados: porQuadro.get(b.id)?.atrasados ?? 0,
    meus:      porQuadro.get(b.id)?.meus      ?? 0,
  }))
}

export async function createBoard(tenantId: string, name: string, color: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('criar_quadro', { p_tenant_id: tenantId, p_name: name, p_color: color })
  falha(error)
  return data as string
}

export async function updateBoard(id: string, patch: Partial<Pick<Board, 'name' | 'color'>>) {
  const { error } = await supabase.from('boards').update(patch).eq('id', id)
  falha(error)
}

export async function deleteBoard(id: string) {
  const { error } = await supabase.from('boards').delete().eq('id', id)
  falha(error)
}

// ── Quadro inteiro ──────────────────────────────────────────────────────────
export async function fetchBoardFull(boardId: string): Promise<BoardFull> {
  const [board, columns, cards, assignees, cardLabels, labels, checklist, comments] = await Promise.all([
    supabase.from('boards').select('*').eq('id', boardId).single(),
    supabase.from('board_columns').select('*').eq('board_id', boardId).order('position'),
    supabase.from('board_cards').select('*').eq('board_id', boardId).is('archived_at', null).order('position'),
    supabase.from('board_card_assignees').select('card_id, user_id').eq('board_id', boardId),
    supabase.from('board_card_labels').select('card_id, label_id').eq('board_id', boardId),
    supabase.from('board_labels').select('*').eq('board_id', boardId).order('created_at'),
    supabase.from('board_checklist_items').select('card_id, done').eq('board_id', boardId),
    supabase.from('board_comments').select('card_id').eq('board_id', boardId),
  ])
  for (const r of [board, columns, cards, assignees, cardLabels, labels, checklist, comments]) falha(r.error)

  const porCartao = new Map<string, CardData>()
  for (const c of (cards.data ?? []) as BoardCard[]) {
    porCartao.set(c.id, { ...c, assignees: [], labelIds: [], checklistTotal: 0, checklistDone: 0, commentCount: 0, leadName: null })
  }
  for (const a of (assignees.data ?? []) as Array<{ card_id: string; user_id: string }>) porCartao.get(a.card_id)?.assignees.push(a.user_id)
  for (const l of (cardLabels.data ?? []) as Array<{ card_id: string; label_id: string }>) porCartao.get(l.card_id)?.labelIds.push(l.label_id)
  for (const i of (checklist.data ?? []) as Array<{ card_id: string; done: boolean }>) {
    const c = porCartao.get(i.card_id); if (!c) continue
    c.checklistTotal++; if (i.done) c.checklistDone++
  }
  for (const k of (comments.data ?? []) as Array<{ card_id: string }>) { const c = porCartao.get(k.card_id); if (c) c.commentCount++ }

  const leadIds = Array.from(new Set(Array.from(porCartao.values()).map((c) => c.lead_id).filter(Boolean))) as string[]
  if (leadIds.length) {
    const { data } = await supabase.from('leads').select('id, name').in('id', leadIds)
    const nomes = new Map((data ?? []).map((l: { id: string; name: string }) => [l.id, l.name]))
    for (const c of porCartao.values()) if (c.lead_id) c.leadName = nomes.get(c.lead_id) ?? null
  }

  return {
    board:   board.data as Board,
    columns: (columns.data ?? []) as BoardColumn[],
    cards:   Array.from(porCartao.values()),
    labels:  (labels.data ?? []) as BoardLabel[],
  }
}

// ── Colunas ─────────────────────────────────────────────────────────────────
export async function createColumn(board: Board, name: string, position: number) {
  const { error } = await supabase.from('board_columns')
    .insert({ tenant_id: board.tenant_id, board_id: board.id, name, position })
  falha(error)
}

export async function updateColumn(id: string, patch: Partial<Pick<BoardColumn, 'name' | 'is_done'>>) {
  const { error } = await supabase.from('board_columns').update(patch).eq('id', id)
  falha(error)
}

export async function deleteColumn(id: string) {
  const { error } = await supabase.from('board_columns').delete().eq('id', id)
  falha(error)
}

export async function reorderColumns(updates: Array<{ id: string; position: number }>) {
  await Promise.all(updates.map((u) => supabase.from('board_columns').update({ position: u.position }).eq('id', u.id)))
}

// ── Cartões ─────────────────────────────────────────────────────────────────
export async function createCard(board: Board, columnId: string, title: string, position: number): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('board_cards')
    .insert({ tenant_id: board.tenant_id, board_id: board.id, column_id: columnId, title, position, created_by: auth.user?.id ?? null })
    .select('id').single()
  falha(error)
  return (data as { id: string }).id
}

export type CardPatch = Partial<Pick<BoardCard, 'title' | 'description' | 'color' | 'lead_id' | 'due_date' | 'column_id' | 'position' | 'archived_at'>>

export async function updateCard(id: string, patch: CardPatch) {
  const { error } = await supabase.from('board_cards').update(patch).eq('id', id)
  falha(error)
}

export async function deleteCard(id: string) {
  const { error } = await supabase.from('board_cards').delete().eq('id', id)
  falha(error)
}

export async function setAssignee(card: BoardCard, userId: string, on: boolean) {
  if (on) {
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('board_card_assignees')
      .insert({ card_id: card.id, user_id: userId, tenant_id: card.tenant_id, board_id: card.board_id, added_by: auth.user?.id ?? null })
    falha(error)
  } else {
    const { error } = await supabase.from('board_card_assignees').delete().eq('card_id', card.id).eq('user_id', userId)
    falha(error)
  }
}

// ── Etiquetas ───────────────────────────────────────────────────────────────
export async function createLabel(board: Board, name: string, color: string): Promise<string> {
  const { data, error } = await supabase.from('board_labels')
    .insert({ tenant_id: board.tenant_id, board_id: board.id, name, color }).select('id').single()
  falha(error)
  return (data as { id: string }).id
}

export async function updateLabel(id: string, patch: Partial<Pick<BoardLabel, 'name' | 'color'>>) {
  const { error } = await supabase.from('board_labels').update(patch).eq('id', id)
  falha(error)
}

export async function deleteLabel(id: string) {
  const { error } = await supabase.from('board_labels').delete().eq('id', id)
  falha(error)
}

export async function setCardLabel(card: BoardCard, labelId: string, on: boolean) {
  if (on) {
    const { error } = await supabase.from('board_card_labels')
      .insert({ card_id: card.id, label_id: labelId, tenant_id: card.tenant_id, board_id: card.board_id })
    falha(error)
  } else {
    const { error } = await supabase.from('board_card_labels').delete().eq('card_id', card.id).eq('label_id', labelId)
    falha(error)
  }
}

// ── Detalhe do cartão: checklist e comentários ──────────────────────────────
export async function fetchCardDetail(cardId: string): Promise<CardDetail> {
  const [{ data: itens, error }, { data: coms, error: e2 }] = await Promise.all([
    supabase.from('board_checklist_items').select('id, card_id, text, done, position').eq('card_id', cardId).order('position'),
    supabase.from('board_comments').select('id, card_id, user_id, body, created_at').eq('card_id', cardId).order('created_at'),
  ])
  falha(error); falha(e2)
  const comments = (coms ?? []) as BoardComment[]
  const userIds = Array.from(new Set(comments.map((c) => c.user_id)))
  const nomes = new Map<string, string>()
  if (userIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; email: string }>) nomes.set(p.id, p.full_name ?? p.email)
  }
  return {
    checklist: (itens ?? []) as BoardChecklistItem[],
    comments:  comments.map((c) => ({ ...c, authorName: nomes.get(c.user_id) ?? 'Alguém' })),
  }
}

export async function addChecklistItem(card: BoardCard, text: string, position: number) {
  const { error } = await supabase.from('board_checklist_items')
    .insert({ tenant_id: card.tenant_id, board_id: card.board_id, card_id: card.id, text, position })
  falha(error)
}

export async function updateChecklistItem(id: string, patch: Partial<Pick<BoardChecklistItem, 'text' | 'done'>>) {
  const { error } = await supabase.from('board_checklist_items').update(patch).eq('id', id)
  falha(error)
}

export async function deleteChecklistItem(id: string) {
  const { error } = await supabase.from('board_checklist_items').delete().eq('id', id)
  falha(error)
}

export async function addComment(card: BoardCard, body: string) {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('board_comments')
    .insert({ tenant_id: card.tenant_id, board_id: card.board_id, card_id: card.id, user_id: auth.user!.id, body })
  falha(error)
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('board_comments').delete().eq('id', id)
  falha(error)
}

// ── Apoio ───────────────────────────────────────────────────────────────────
export async function fetchMembros(tenantId: string): Promise<Membro[]> {
  const { data, error } = await supabase.rpc('membros_da_empresa', { p_tenant_id: tenantId })
  falha(error)
  return (data ?? []) as Membro[]
}

export async function searchLeads(tenantId: string, q: string): Promise<Array<{ id: string; name: string; company_name: string | null }>> {
  let query = supabase.from('leads').select('id, name, company_name').eq('tenant_id', tenantId).order('name').limit(12)
  if (q.trim()) query = query.ilike('name', `%${q.trim()}%`)
  const { data, error } = await query
  falha(error)
  return (data ?? []) as Array<{ id: string; name: string; company_name: string | null }>
}

/** Posição entre dois vizinhos — cartões usam número quebrado pra não reescrever a coluna toda. */
export function posicaoEntre(anterior: number | undefined, proximo: number | undefined): number {
  if (anterior === undefined && proximo === undefined) return 0
  if (anterior === undefined) return proximo! - 1
  if (proximo === undefined) return anterior + 1
  return (anterior + proximo) / 2
}
