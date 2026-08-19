/**
 * Período em foco do Financeiro.
 *
 * Fica fora do componente porque exportar função junto com componente quebra
 * o fast refresh — mesmo motivo pelo qual as preferências do Meta Ads também
 * moram num módulo próprio.
 */

export type ModoPeriodo = 'mes' | 'livre'

export interface Periodo {
  modo:  ModoPeriodo
  from:  string      // yyyy-mm-dd
  to:    string
  label: string
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** yyyy-mm-dd pelos getters locais — toISOString() usaria UTC e adiantaria o dia. */
export function toISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function periodoDoMes(ref: Date): Periodo {
  const nome = MESES[ref.getMonth()]
  return {
    modo:  'mes',
    from:  toISO(new Date(ref.getFullYear(), ref.getMonth(), 1)),
    to:    toISO(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
    label: `${nome[0].toUpperCase()}${nome.slice(1)} de ${ref.getFullYear()}`,
  }
}

function formatarBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function periodoLivre(from: string, to: string): Periodo {
  return { modo: 'livre', from, to, label: `${formatarBR(from)} a ${formatarBR(to)}` }
}

/** Últimos N meses inteiros, terminando no mês atual. */
export function ultimosMeses(n: number): Periodo {
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1), 1)
  const fim    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  return { ...periodoLivre(toISO(inicio), toISO(fim)), label: `Últimos ${n} meses` }
}

export function anoAtual(): Periodo {
  const ano = new Date().getFullYear()
  return { ...periodoLivre(`${ano}-01-01`, `${ano}-12-31`), label: `Ano de ${ano}` }
}

/**
 * Janela anterior de MESMO tamanho, pra comparação honesta.
 * Comparar um trimestre com o mês anterior daria variação sem sentido.
 */
export function periodoAnterior(p: Periodo): { from: string; to: string } {
  const de  = new Date(p.from + 'T00:00:00')
  const ate = new Date(p.to + 'T00:00:00')

  if (p.modo === 'mes') {
    const ant = new Date(de.getFullYear(), de.getMonth() - 1, 1)
    return {
      from: toISO(ant),
      to:   toISO(new Date(ant.getFullYear(), ant.getMonth() + 1, 0)),
    }
  }

  const dias = Math.round((ate.getTime() - de.getTime()) / 86_400_000) + 1
  const fimAnt = new Date(de.getTime() - 86_400_000)
  const iniAnt = new Date(fimAnt.getTime() - (dias - 1) * 86_400_000)
  return { from: toISO(iniAnt), to: toISO(fimAnt) }
}
