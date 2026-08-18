import type { Campaign } from '@/services/metaAds'

/**
 * Definição única das métricas do Meta Ads.
 *
 * Tabela, totais e relatório impresso leem daqui — sem isso, cada lugar
 * formataria do seu jeito e o relatório sairia diferente da tela.
 */

export type ColumnKey =
  | 'name' | 'status' | 'objective'
  | 'spend' | 'reach' | 'impressions' | 'frequency'
  | 'clicks' | 'ctr' | 'cpc' | 'cpm'
  | 'results' | 'leads' | 'conversations' | 'purchases' | 'cpl'

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const int   = (n: number) => n.toLocaleString('pt-BR')
const pct   = (n: number) => `${n.toFixed(2)}%`
const dec2  = (n: number) => n.toFixed(2)

/**
 * Como o total da coluna é calculado.
 * - `sum`: soma direta das campanhas.
 * - `derived`: recalculado a partir dos totais brutos. Média de CPC entre
 *   campanhas NÃO é o CPC do conjunto — quem gastou mais tem que pesar mais.
 * - `none`: não faz sentido totalizar (nome, status).
 */
type TotalKind = 'sum' | 'derived' | 'none'

export interface MetaColumn {
  key:     ColumnKey
  label:   string
  hint?:   string
  align:   'left' | 'right'
  /** Sempre visível — não entra no seletor de métricas. */
  fixed?:  boolean
  get:     (c: Campaign) => number | null
  format:  (v: number) => string
  total:   TotalKind
  /** Só para `derived`: recebe os totais brutos já somados. */
  deriveTotal?: (t: RawTotals) => number | null
}

export interface RawTotals {
  spend:         number
  reach:         number
  impressions:   number
  clicks:        number
  results:       number
  leads:         number
  conversations: number
  purchases:     number
}

export const META_COLUMNS: MetaColumn[] = [
  { key: 'name',   label: 'Campanha', align: 'left', fixed: true,
    get: () => null, format: () => '', total: 'none' },
  { key: 'status', label: 'Status',   align: 'left', fixed: true,
    get: () => null, format: () => '', total: 'none' },

  { key: 'spend', label: 'Gasto', align: 'right',
    hint: 'Investimento no período',
    get: (c) => c.spend, format: formatBRL, total: 'sum' },

  { key: 'reach', label: 'Alcance', align: 'right',
    hint: 'Pessoas únicas que viram o anúncio',
    get: (c) => c.reach, format: int, total: 'sum' },

  { key: 'impressions', label: 'Impressões', align: 'right',
    hint: 'Quantas vezes o anúncio foi exibido',
    get: (c) => c.impressions, format: int, total: 'sum' },

  { key: 'frequency', label: 'Freq.', align: 'right',
    hint: 'Quantas vezes a mesma pessoa viu o anúncio',
    get: (c) => c.frequency, format: dec2, total: 'derived',
    deriveTotal: (t) => (t.reach > 0 ? t.impressions / t.reach : null) },

  { key: 'clicks', label: 'Cliques', align: 'right',
    get: (c) => c.clicks, format: int, total: 'sum' },

  { key: 'ctr', label: 'CTR', align: 'right',
    hint: 'Cliques ÷ impressões',
    get: (c) => c.ctr, format: pct, total: 'derived',
    deriveTotal: (t) => (t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null) },

  { key: 'cpc', label: 'CPC', align: 'right',
    hint: 'Custo por clique',
    get: (c) => c.cpc, format: formatBRL, total: 'derived',
    deriveTotal: (t) => (t.clicks > 0 ? t.spend / t.clicks : null) },

  { key: 'cpm', label: 'CPM', align: 'right',
    hint: 'Custo por mil impressões',
    get: (c) => c.cpm, format: formatBRL, total: 'derived',
    deriveTotal: (t) => (t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null) },

  { key: 'results', label: 'Resultados', align: 'right',
    hint: 'Leads de formulário + conversas iniciadas',
    get: (c) => c.results ?? null, format: int, total: 'sum' },

  { key: 'leads', label: 'Leads', align: 'right',
    hint: 'Só leads de formulário',
    get: (c) => c.leads_generated, format: int, total: 'sum' },

  { key: 'conversations', label: 'Conversas', align: 'right',
    hint: 'Conversas iniciadas no WhatsApp/Direct',
    get: (c) => c.conversations, format: int, total: 'sum' },

  { key: 'purchases', label: 'Compras', align: 'right',
    hint: 'Compras atribuídas pela Meta',
    get: (c) => c.purchases, format: int, total: 'sum' },

  { key: 'cpl', label: 'Custo/result.', align: 'right',
    hint: 'Gasto ÷ resultados',
    get: (c) => c.cpl ?? null, format: formatBRL, total: 'derived',
    deriveTotal: (t) => (t.results > 0 ? t.spend / t.results : null) },
]

/** Colunas que a pessoa pode ligar/desligar (as fixas ficam de fora). */
export const SELECTABLE_COLUMNS = META_COLUMNS.filter((c) => !c.fixed)

/** Seleção inicial: o que já era mostrado antes do seletor existir. */
export const DEFAULT_COLUMNS: ColumnKey[] = [
  'spend', 'reach', 'impressions', 'frequency',
  'clicks', 'ctr', 'cpc', 'cpm', 'results', 'cpl',
]

export function somarTotais(campaigns: Campaign[]): RawTotals {
  return campaigns.reduce<RawTotals>(
    (acc, c) => ({
      spend:         acc.spend         + (c.spend ?? 0),
      reach:         acc.reach         + (c.reach ?? 0),
      impressions:   acc.impressions   + (c.impressions ?? 0),
      clicks:        acc.clicks        + (c.clicks ?? 0),
      results:       acc.results       + (c.results ?? 0),
      leads:         acc.leads         + (c.leads_generated ?? 0),
      conversations: acc.conversations + (c.conversations ?? 0),
      purchases:     acc.purchases     + (c.purchases ?? 0),
    }),
    { spend: 0, reach: 0, impressions: 0, clicks: 0, results: 0, leads: 0, conversations: 0, purchases: 0 },
  )
}

/** Valor do rodapé de uma coluna, já respeitando soma x derivação. */
export function totalDaColuna(col: MetaColumn, totais: RawTotals): number | null {
  if (col.total === 'none') return null
  if (col.total === 'derived') return col.deriveTotal?.(totais) ?? null

  switch (col.key) {
    case 'spend':         return totais.spend
    case 'reach':         return totais.reach
    case 'impressions':   return totais.impressions
    case 'clicks':        return totais.clicks
    case 'results':       return totais.results
    case 'leads':         return totais.leads
    case 'conversations': return totais.conversations
    case 'purchases':     return totais.purchases
    default:              return null
  }
}
