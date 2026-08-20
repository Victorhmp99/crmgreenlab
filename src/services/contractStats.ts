import { supabase } from '@/lib/supabase'
import { getContractTotalValue, type AccrualContract } from './contractAccrual'

/**
 * Visão gerencial da carteira: composição de contratos e o que mais vende.
 *
 * Responde as perguntas que a tela de lançamentos não responde — "quanto da
 * minha receita é recorrente?" e "qual produto puxa o faturamento?".
 */

export interface CarteiraContratos {
  recorrentesAtivos: number
  unicosNoPeriodo:   number
  /** Soma das mensalidades ativas — a receita que se repete todo mês. */
  mrr:               number
  /** Valor fechado dos contratos de pagamento único iniciados no período. */
  tcvNoPeriodo:      number
  pausados:          number
  cancelados:        number
  /** Ativos que terminam nos próximos 30 dias — o que precisa de renovação. */
  vencendoEm30Dias:  number
}

export async function fetchCarteiraContratos(
  tenantId: string,
  from:     string,
  to:       string,
): Promise<CarteiraContratos> {
  const { data, error } = await supabase
    .from('client_contracts')
    .select('billing_type, amount, installments, start_date, end_date, status, updated_at')
    .eq('tenant_id', tenantId)

  if (error) throw error

  const hoje = new Date()
  const em30 = new Date(hoje.getTime() + 30 * 86_400_000)

  const out: CarteiraContratos = {
    recorrentesAtivos: 0, unicosNoPeriodo: 0, mrr: 0,
    tcvNoPeriodo: 0, pausados: 0, cancelados: 0, vencendoEm30Dias: 0,
  }

  for (const row of data ?? []) {
    const amount = Number(row.amount)

    if (row.status === 'paused')    out.pausados++
    if (row.status === 'cancelled') out.cancelados++

    if (row.status === 'active' && row.billing_type === 'recurring') {
      out.recorrentesAtivos++
      out.mrr += amount

      if (row.end_date) {
        const fim = new Date(row.end_date + 'T00:00:00')
        if (fim >= hoje && fim <= em30) out.vencendoEm30Dias++
      }
    }

    // Pagamento único conta pelo período em que foi FECHADO — é uma venda
    // pontual, não uma base que se acumula.
    if (row.billing_type === 'one_time' && row.start_date >= from && row.start_date <= to) {
      out.unicosNoPeriodo++
      const contrato: AccrualContract = {
        billing_type: 'one_time',
        amount,
        installments: row.installments,
        start_date:   row.start_date,
        end_date:     row.end_date ?? null,
        status:       row.status,
        updated_at:   row.updated_at,
      }
      out.tcvNoPeriodo += getContractTotalValue(contrato)
    }
  }

  return out
}

export interface ProdutoVendido {
  productId: string | null
  nome:      string
  vendas:    number
  total:     number
}

export interface CategoriaVendida {
  categoria: string
  vendas:    number
  total:     number
}

export interface Vendas {
  produtos:   ProdutoVendido[]
  categorias: CategoriaVendida[]
}

const SEM_CATEGORIA = 'Sem categoria'

/** Formato do embed aninhado produto → categoria que o Supabase devolve. */
type ProdutoEmbed = { name: string; financial_categories: { name: string } | null } | null

function nomeCategoria(embed: unknown): string {
  return (embed as ProdutoEmbed)?.financial_categories?.name ?? SEM_CATEGORIA
}

/**
 * O que mais vende no período — por produto e por categoria.
 *
 * As duas visões saem da MESMA varredura porque saem dos mesmos registros:
 * separar em duas funções faria duas idas ao banco pra recontar as mesmas
 * vendas, com risco de os dois rankings discordarem entre si.
 *
 * Junta duas origens, porque venda entra pelos dois caminhos: itens de
 * contrato e compras avulsas lançadas no lead. Olhar só um dos dois daria
 * um ranking que contradiz o faturamento.
 *
 * O preço do ITEM de contrato é apenas ilustrativo — quem manda no
 * faturamento é sempre `client_contracts.amount`. Um contrato com um item
 * só recebe o valor cheio do contrato; um contrato com vários itens divide
 * esse valor PROPORCIONALMENTE ao preço de cada item (usado só como peso da
 * divisão, nunca como valor absoluto). Isso garante que a soma do ranking
 * pra um contrato bate exatamente com o valor dele — nem mais, nem menos —
 * mesmo que os preços dos itens tenham sido digitados de qualquer jeito.
 *
 * A categoria vem sempre do produto do catálogo, nunca de texto digitado à
 * mão: é o vínculo que mantém "produtos mais vendidos" e "categorias que
 * mais vendem" contando exatamente a mesma venda.
 */
export async function fetchVendas(
  tenantId: string,
  from:     string,
  to:       string,
  limite = 8,
): Promise<Vendas> {
  const [itensRes, lancRes] = await Promise.all([
    supabase
      .from('contract_items')
      .select('contract_id, product_id, description, unit_price, quantity, financial_products(name, financial_categories(name)), client_contracts!inner(amount, start_date, status)')
      .eq('tenant_id', tenantId)
      .gte('client_contracts.start_date', from)
      .lte('client_contracts.start_date', to),
    supabase
      .from('financial_records')
      .select('product_id, description, amount, financial_products(name, financial_categories(name))')
      .eq('tenant_id', tenantId)
      .eq('type', 'revenue')
      .not('product_id', 'is', null)
      .gte('date', from)
      .lte('date', to),
  ])

  if (itensRes.error) throw itensRes.error
  if (lancRes.error)  throw lancRes.error

  const porProduto   = new Map<string, ProdutoVendido>()
  const porCategoria = new Map<string, CategoriaVendida>()

  function somar(
    chave: string, nome: string, productId: string | null,
    categoria: string, qtd: number, valor: number,
  ) {
    const prod = porProduto.get(chave)
    if (prod) { prod.vendas += qtd; prod.total += valor }
    else      porProduto.set(chave, { productId, nome, vendas: qtd, total: valor })

    const cat = porCategoria.get(categoria)
    if (cat) { cat.vendas += qtd; cat.total += valor }
    else     porCategoria.set(categoria, { categoria, vendas: qtd, total: valor })
  }

  // Agrupa os itens por contrato pra poder distribuir o valor REAL de cada
  // contrato entre eles — não dá pra somar item a item direto.
  type ItemRow = {
    product_id: string | null; description: string; categoria: string
    unit_price: number; quantity: number
  }
  const porContrato = new Map<string, { amount: number; itens: ItemRow[] }>()

  for (const row of itensRes.data ?? []) {
    const contrato = row.client_contracts as unknown as { amount: number } | { amount: number }[]
    const amount = Number(Array.isArray(contrato) ? contrato[0]?.amount : contrato?.amount)
    const grupo = porContrato.get(row.contract_id) ?? { amount, itens: [] }
    grupo.itens.push({
      product_id: row.product_id, description: row.description,
      categoria:  nomeCategoria(row.financial_products),
      unit_price: Number(row.unit_price), quantity: Number(row.quantity),
    })
    porContrato.set(row.contract_id, grupo)
  }

  for (const { amount, itens } of porContrato.values()) {
    const pesoTotal = itens.reduce((s, it) => s + it.unit_price * it.quantity, 0)

    for (const it of itens) {
      const peso = it.unit_price * it.quantity
      // Preço zerado ou não preenchido: divide o valor do contrato em
      // partes iguais entre os itens, em vez de zerar a parte desse item.
      const parte = pesoTotal > 0 ? (peso / pesoTotal) * amount : amount / itens.length
      // Agrupa por produto quando há vínculo; itens avulsos agrupam pelo
      // texto, senão cada linha viraria um produto diferente.
      const chave = it.product_id ?? `avulso:${it.description}`
      somar(chave, it.description, it.product_id, it.categoria, it.quantity, parte)
    }
  }

  for (const row of lancRes.data ?? []) {
    const prod  = row.financial_products as unknown as ProdutoEmbed
    const chave = row.product_id as string
    somar(
      chave, prod?.name ?? row.description ?? 'Produto', chave,
      nomeCategoria(row.financial_products), 1, Number(row.amount),
    )
  }

  const porTotal = (a: { total: number }, b: { total: number }) => b.total - a.total

  return {
    produtos:   [...porProduto.values()].sort(porTotal).slice(0, limite),
    categorias: [...porCategoria.values()].sort(porTotal).slice(0, limite),
  }
}
