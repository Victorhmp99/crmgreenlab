import { useState } from 'react'
import Papa from 'papaparse'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { importLeads, type ImportLeadRow } from '@/services/leads'
import type { LeadSource } from '@/types'

export interface CsvRow {
  [key: string]: string
}

export interface ColumnMapping {
  name: string
  phone: string
  email: string
  source: string
  source_campaign: string
  notes: string
}

// Tenta mapear automaticamente os cabeçalhos do CSV para os campos de lead
export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const patterns: Record<keyof ColumnMapping, RegExp> = {
    name:            /^(nome|name|lead|cliente|paciente)/i,
    phone:           /^(telefone|phone|tel|celular|whatsapp|fone)/i,
    email:           /^(email|e-mail|e_mail|mail)/i,
    source:          /^(origem|source|canal|fonte)/i,
    source_campaign: /^(campanha|campaign|anuncio|ad)/i,
    notes:           /^(obs|observa|nota|note|comment|anotação)/i,
  }

  const mapping: Partial<ColumnMapping> = {}

  for (const header of headers) {
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(header) && !mapping[field as keyof ColumnMapping]) {
        mapping[field as keyof ColumnMapping] = header
      }
    }
  }

  return mapping
}

function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  return { headers, rows: result.data }
}

// Converte URL pública do Google Sheets para URL de exportação CSV
export function sheetsUrlToCsvUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('URL do Google Sheets inválida.')

  const sheetId = match[1]
  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

function mapRowsToLeads(rows: CsvRow[], mapping: Partial<ColumnMapping>): ImportLeadRow[] {
  const validSources: LeadSource[] = ['manual', 'import', 'meta_ads', 'google', 'referral', 'other']
  const results: ImportLeadRow[] = []

  for (const row of rows) {
    const name = mapping.name ? row[mapping.name]?.trim() : ''
    if (!name) continue

    const rawSource = mapping.source ? row[mapping.source]?.trim().toLowerCase() : ''
    const source: LeadSource = validSources.includes(rawSource as LeadSource)
      ? (rawSource as LeadSource)
      : 'import'

    results.push({
      name,
      phone:           mapping.phone           ? row[mapping.phone]?.trim()           || undefined : undefined,
      email:           mapping.email           ? row[mapping.email]?.trim()           || undefined : undefined,
      source,
      source_campaign: mapping.source_campaign ? row[mapping.source_campaign]?.trim() || undefined : undefined,
      notes:           mapping.notes           ? row[mapping.notes]?.trim()           || undefined : undefined,
    })
  }

  return results
}

export function useLeadImport() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.id)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({})
  const [parseError, setParseError] = useState<string | null>(null)

  function reset() {
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setParseError(null)
  }

  async function loadFromFile(file: File) {
    setParseError(null)
    const text = await file.text()
    const { headers, rows } = parseCsvText(text)
    setCsvHeaders(headers)
    setCsvRows(rows)
    setMapping(autoDetectMapping(headers))
  }

  async function loadFromSheetsUrl(url: string) {
    setParseError(null)
    try {
      const csvUrl = sheetsUrlToCsvUrl(url)
      const response = await fetch(csvUrl)
      if (!response.ok) throw new Error(`Erro ao buscar planilha: ${response.status}`)
      const text = await response.text()
      const { headers, rows } = parseCsvText(text)
      setCsvHeaders(headers)
      setCsvRows(rows)
      setMapping(autoDetectMapping(headers))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setParseError(message)
    }
  }

  const importMutation = useMutation({
    mutationFn: () => {
      const rows = mapRowsToLeads(csvRows, mapping)
      if (rows.length === 0) throw new Error('Nenhuma linha válida para importar.')
      return importLeads(tenantId!, rows)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', tenantId] })
      reset()
    },
  })

  const previewRows = mapRowsToLeads(csvRows, mapping).slice(0, 5)

  return {
    csvHeaders,
    csvRows,
    mapping,
    setMapping,
    parseError,
    previewRows,
    totalRows: mapRowsToLeads(csvRows, mapping).length,
    loadFromFile,
    loadFromSheetsUrl,
    importMutation,
    reset,
  }
}
