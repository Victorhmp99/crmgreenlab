// Funções puras de cálculo de contrato — sem dependência de supabase, pra
// poder ser usadas tanto em clientContracts.ts quanto em financial.ts sem
// criar import circular entre os dois.

export type AccrualBillingType = 'recurring' | 'one_time'
export type AccrualStatus      = 'active' | 'paused' | 'cancelled' | 'completed'

export interface AccrualContract {
  billing_type: AccrualBillingType
  amount:       number
  installments: number | null
  start_date:   string
  /** Fim do contrato. Null = sem prazo de término. */
  end_date:     string | null
  status:       AccrualStatus
  updated_at:   string
}

export interface AccruedInstallment {
  date:   string  // yyyy-mm-dd
  amount: number
}

// ── Helpers de data ─────────────────────────────────────────────────────────
// IMPORTANTE: nunca usar toISOString() pra extrair "a data" — ele converte pra
// UTC e no Brasil (UTC-3) vira o dia seguinte depois das 21h. Sempre formatar
// pelos getters locais.

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formata uma Date como yyyy-mm-dd usando o fuso LOCAL (não UTC). */
export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** A data de hoje (yyyy-mm-dd) no fuso local. */
export function todayLocal(): string {
  return toLocalDateString(new Date())
}

/**
 * Soma meses a uma data TRAVANDO no último dia do mês quando o dia não existe
 * — mesmo comportamento do Postgres (`date + interval 'N months'`).
 * Sem isso, 31/01 + 1 mês viraria 03/03 no JS, pulando fevereiro e colocando
 * duas parcelas em março (o SQL e o TS ficariam divergentes).
 */
export function addMonthsClamped(base: Date, months: number): Date {
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1)
  const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(base.getDate(), lastDayOfTarget))
  return target
}

/** Quantos meses corridos se passaram desde o início (mínimo 1). */
export function elapsedMonths(startDate: string, asOf: Date): number {
  const start = new Date(startDate + 'T00:00:00')
  const months = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth())
  return Math.max(0, months) + 1
}

/**
 * Parcela atual (1-indexed) — usa a data de hoje de verdade, pra mostrar
 * "em que mês estamos" no card do contrato. Pra contrato com prazo, nunca
 * ultrapassa o total. Sem prazo (installments null), é só o mês corrido.
 */
export function getCurrentInstallment(contract: AccrualContract): number {
  const elapsed = elapsedMonths(contract.start_date, new Date())
  return contract.installments != null ? Math.min(elapsed, contract.installments) : elapsed
}

/**
 * Lista o CRONOGRAMA de parcelas do contrato (data + valor) — cada parcela
 * pertence ao mês em que está agendada, independente da data de hoje. Não
 * espera "o calendário chegar lá": se o contrato tá ativo, a parcela de
 * daqui a 2 meses já existe no cronograma (é isso que faz "setembro" mostrar
 * a parcela de setembro quando você navega pra lá, mesmo hoje sendo agosto).
 *
 * Pausar/cancelar CONGELA o cronograma na última atualização — só as parcelas
 * agendadas ATÉ ALI continuam existindo; nada depois disso é gerado.
 *
 * Quem decide "até quando olhar" é quem CONSOME essa lista: uma consulta com
 * período explícito (ex: "setembro") vê a parcela de setembro numa boa; uma
 * consulta sem período (histórico geral) deve limitar em "hoje" — isso é
 * responsabilidade de quem chama, não desta função.
 */
export function expandAccruedInstallments(contract: AccrualContract): AccruedInstallment[] {
  const start = new Date(contract.start_date + 'T00:00:00')

  // Dois limites diferentes, e vale o menor deles:
  //  - status: se não está mais ativo, congela na última atualização
  //  - end_date: o contrato acabou naquele dia, independente do status
  // Sem o segundo, um contrato com fim definido seguiria acumulando receita
  // até a rotina diária pausá-lo — contando um dia que não existe.
  const cutoffStatus = contract.status === 'active'
    ? null
    : toLocalDateString(new Date(contract.updated_at))
  const cutoff = [cutoffStatus, contract.end_date]
    .filter((d): d is string => !!d)
    .sort()[0] ?? null

  if (contract.billing_type === 'one_time') {
    if (cutoff && contract.start_date > cutoff) return []
    return [{ date: contract.start_date, amount: contract.amount }]
  }

  const cap = contract.installments ?? 1200 // sem prazo: sem teto real, só limita por segurança
  const out: AccruedInstallment[] = []
  for (let i = 0; i < cap; i++) {
    const dueStr = toLocalDateString(addMonthsClamped(start, i))
    if (cutoff && dueStr > cutoff) break
    out.push({ date: dueStr, amount: contract.amount })
  }
  return out
}

/**
 * Valor total do contrato (usado como "Faturamento" — quanto foi vendido).
 * - ATIVO: o valor cheio comprometido (único = o valor; com prazo = mensal ×
 *   parcelas; sem prazo = acumulado mês a mês até agora).
 * - PAUSADO/CANCELADO/CONCLUÍDO: congela no que já foi acumulado até a última
 *   atualização — NÃO zera. Zerar quebraria a coerência do sistema (a Receita
 *   continua contando o que já foi recebido, e Receita nunca pode ser maior
 *   que Faturamento).
 */
export function getContractTotalValue(contract: AccrualContract | null | undefined): number {
  if (!contract) return 0

  if (contract.status !== 'active') {
    // Congelado: vale o que o cronograma já tinha acumulado até parar
    return expandAccruedInstallments(contract).reduce((sum, i) => sum + i.amount, 0)
  }

  if (contract.billing_type === 'one_time') return contract.amount

  if (contract.installments != null) return contract.amount * contract.installments

  // Recorrente sem prazo, ativo: acumula mês a mês até agora
  return contract.amount * elapsedMonths(contract.start_date, new Date())
}

/**
 * Soma de todas as parcelas do cronograma até HOJE — é o equivalente a
 * "quanto já devia ter recebido até agora, sem escolher período". Pra ver um
 * mês específico (passado ou futuro), use expandAccruedInstallments + filtre
 * pela data desejada.
 */
export function getContractAccruedRevenue(contract: AccrualContract | null | undefined): number {
  if (!contract) return 0
  const today = todayLocal()
  return expandAccruedInstallments(contract)
    .filter((i) => i.date <= today)
    .reduce((sum, i) => sum + i.amount, 0)
}
