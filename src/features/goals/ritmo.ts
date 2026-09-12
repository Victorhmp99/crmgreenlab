/**
 * Ritmo esperado de uma meta: que fração do período já passou.
 *
 * É a régua contra a qual "está atrás" faz sentido — 40% da meta no dia 12
 * de um mês de 30 é bom; no dia 25 é problema. A rotina diária do banco usa
 * a mesma conta (dias corridos, inclui hoje) pra decidir os avisos de ritmo e
 * risco; se mudar aqui, muda lá.
 */
export function ritmoDaMeta(startDate: string, endDate: string, hoje = new Date()) {
  const ini = new Date(startDate + 'T00:00:00')
  const fim = new Date(endDate   + 'T00:00:00')
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const umDia = 86_400_000

  const total   = Math.round((fim.getTime() - ini.getTime()) / umDia) + 1
  const passado = Math.min(total, Math.max(0, Math.round((dia.getTime() - ini.getTime()) / umDia) + 1))
  const restam  = Math.max(0, Math.round((fim.getTime() - dia.getTime()) / umDia))

  return {
    totalDias:   total,
    diasPassados: passado,
    diasRestantes: restam,
    /** 0–100: quanto do período já passou. */
    esperadoPct: total > 0 ? Math.round((passado / total) * 100) : 0,
    encerrada:   dia > fim,
    naoComecou:  dia < ini,
  }
}

/** Como a meta está em relação ao ritmo: 'na frente', 'no ritmo' ou 'atrás'. */
export function situacaoDaMeta(percentGeral: number, esperadoPct: number): 'frente' | 'ritmo' | 'atras' {
  if (percentGeral >= 100) return 'frente'
  if (percentGeral >= esperadoPct) return percentGeral - esperadoPct >= 10 ? 'frente' : 'ritmo'
  return 'atras'
}
