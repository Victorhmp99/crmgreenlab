import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatDateTimeShort(date: string | Date): string {
  const d = new Date(date)
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
