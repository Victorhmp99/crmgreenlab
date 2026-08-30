/**
 * Resultado de uma ligação, em valores fixos.
 *
 * Fica separado do componente porque também é usado pelo relatório e, no
 * futuro, pela telefonia — que vai gravar o mesmo conjunto de valores vindo
 * do webhook. Texto livre não serviria: sem valor fixo não dá pra calcular
 * taxa de atendimento.
 */
export const RESULTADOS = [
  { valor: 'atendeu',       rotulo: 'Atendeu',       cor: '#00e676' },
  { valor: 'nao_atendeu',   rotulo: 'Não atendeu',   cor: '#fbbf24' },
  { valor: 'caixa_postal',  rotulo: 'Caixa postal',  cor: '#a78bfa' },
  { valor: 'numero_errado', rotulo: 'Número errado', cor: '#ff4444' },
] as const

export type ResultadoLigacao = typeof RESULTADOS[number]['valor']

export function rotuloDoResultado(valor: string | null | undefined): string | null {
  return RESULTADOS.find((r) => r.valor === valor)?.rotulo ?? null
}
