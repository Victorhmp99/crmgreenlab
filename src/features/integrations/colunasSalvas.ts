import { SELECTABLE_COLUMNS, DEFAULT_COLUMNS, type ColumnKey } from './metaColumns'

/*
 * Preferência de métricas visíveis, por empresa, guardada no navegador.
 *
 * É preferência de quem olha, não configuração da conta: dois gestores da
 * mesma empresa podem querer recortes diferentes sem um atrapalhar o outro.
 * Fica fora do componente porque exportar função junto com componente quebra
 * o fast refresh.
 */

export function chaveDaPreferencia(tenantId: string): string {
  return `meta-ads-colunas:${tenantId}`
}

export function lerColunasSalvas(tenantId: string): ColumnKey[] {
  try {
    const cru = localStorage.getItem(chaveDaPreferencia(tenantId))
    if (!cru) return DEFAULT_COLUMNS

    const lista = JSON.parse(cru) as unknown
    if (!Array.isArray(lista)) return DEFAULT_COLUMNS

    // Filtra contra o catálogo atual: métrica removida numa versão futura não
    // pode quebrar a tela de quem tinha ela salva.
    const validas = lista.filter((k): k is ColumnKey =>
      SELECTABLE_COLUMNS.some((c) => c.key === k))

    return validas.length > 0 ? validas : DEFAULT_COLUMNS
  } catch {
    return DEFAULT_COLUMNS
  }
}

export function salvarColunas(tenantId: string, colunas: ColumnKey[]): void {
  try {
    localStorage.setItem(chaveDaPreferencia(tenantId), JSON.stringify(colunas))
  } catch {
    /* navegador sem storage disponível — a escolha vale só nesta sessão */
  }
}
