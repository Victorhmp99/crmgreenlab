import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Data inválida NÃO pode chegar no Intl: `format()` com Invalid Date lança
 * RangeError, e uma exceção durante o render desmonta a árvore inteira do
 * React — a tela some. Foi o que acontecia ao limpar a data em Relatórios: o
 * X zera pra string vazia, `new Date('')` vira Invalid Date, e o CRM inteiro
 * ficava preto por causa de um rótulo de período.
 *
 * Vale pros três formatadores: são usados em ~26 lugares, e qualquer valor
 * vazio, nulo ou malformado em qualquer um deles derrubaria a tela do mesmo
 * jeito.
 */
function dataValida(date: string | Date | null | undefined): Date | null {
  if (date === null || date === undefined || date === '') return null

  /* Data PURA ('2026-08-30', sem hora) é lida como meia-noite UTC — que no
     Brasil (UTC-3) é 21h do dia ANTERIOR. Resultado: início de contrato,
     vencimento, meta e lançamento financeiro apareciam todos um dia antes do
     que está gravado.
     Montando pelos componentes, a data vira meia-noite LOCAL e o dia exibido é
     o dia guardado. Carimbo de tempo completo (com hora e fuso) continua
     convertido normalmente — ali a conversão é o certo. */
  if (typeof date === 'string') {
    const puro = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (puro) {
      const d = new Date(Number(puro[1]), Number(puro[2]) - 1, Number(puro[3]))
      return Number.isNaN(d.getTime()) ? null : d
    }
  }

  const d = date instanceof Date ? date : new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = dataValida(date)
  if (!d) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const d = dataValida(date)
  if (!d) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatDateTimeShort(date: string | Date | null | undefined): string {
  const d = dataValida(date)
  if (!d) return '—'
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: '2-digit' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2)
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  if (digits.length === 9)  return `${digits.slice(0, 5)}-${digits.slice(5)}`
  if (digits.length === 8)  return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return phone
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

// ── Formatação de moeda BRL ──────────────────────────────────────────────────

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'R$ —'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Versão compacta para cards (R$ 1,5k, R$ 25k, R$ 1,2M)
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000)     return `R$ ${(value / 1_000).toFixed(1).replace('.', ',')}k`
  return `R$ ${value.toFixed(0)}`
}

// Converte string "1.500,00" → 1500.00 (entrada de form)
export function parseCurrencyInput(input: string): number | null {
  if (!input || input.trim() === '') return null
  const cleaned = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
