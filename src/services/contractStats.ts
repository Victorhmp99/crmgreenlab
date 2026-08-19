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

/**
 * Produtos mais vendidos no período.
 *
 * Junta duas origens, porque venda entra pelos dois caminhos: itens de
 * contrato e compras avulsas lançadas no lead. Olhar só um dos dois daria
 * um ranking que contradiz o faturamento.
 */
export async function fetchProdutosMaisVendidos(
  tenantId: string,
  from:     string,
  to:       string,
  limite = 8,
): Promise<ProdutoVendido[]> {
  const [itensRes, lancRes] = await Promise.all([
    supabase
      .from('contract_items')
      .select('product_id, description, unit_price, quantity, client_contracts!inner(start_date, status)')
      .eq('tenant_id', tenantId)
      .gte('client_contracts.start_date', from)
      .lte('client_contracts.start_date', to),
    supabase
      .from('financial_records')
      .select('product_id, description, amount, financial_products(name)')
      .eq('tenant_id', tenantId)
      .eq('type', 'revenue')
      .not('product_id', 'is', null)
      .gte('date', from)
      .lte('date', to),
  ])

  if (itensRes.error) throw itensRes.error
  if (lancRes.error)  throw lancRes.error

  const mapa = new Map<string, ProdutoVendido>()

  function somar(chave: string, nome: string, productId: string | null, qtd: number, valor: number) {
    const atual = mapa.get(chave)
    if (atual) {
      atual.vendas += qtd
      atual.total  += valor
    } else {
      mapa.set(chave, { productId, nome, vendas: qtd, total: valor })
    }
  }

  for (const row of itensRes.data ?? []) {
    const qtd = Number(row.quantity)
    // Agrupa por produto quando há vínculo; itens avulsos agrupam pelo texto,
    // senão cada linha viraria uma "categoria" diferente no ranking.
    const chave = row.product_id ?? `avulso:${row.description}`
    somar(chave, row.description, row.product_id, qtd, Number(row.unit_price) * qtd)
  }

  for (const row of lancRes.data ?? []) {
    const prod = row.financial_products as unknown as { name: string } | null
    const chave = row.product_id as string
    somar(chave, prod?.name ?? row.description ?? 'Produto', chave, 1, Number(row.amount))
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, limite)
}
