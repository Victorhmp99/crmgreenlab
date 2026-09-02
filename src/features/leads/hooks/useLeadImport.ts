import { useState, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { importLeads, type ImportLeadRow } from '@/services/leads'
import { fetchLeadFields } from '@/services/leadFieldDefinitions'
import type { LeadSource, LeadStatus, LeadFieldDefinition } from '@/types'

export interface CsvRow {
  [key: string]: string
}

// Campos padrão importáveis (key → coluna CSV)
export interface StdColumnMapping {
  name?:            string
  company_name?:    string
  phone?:           string
  email?:           string
  status?:          string
  source?:          string
  source_campaign?: string
  channel?:         string
  value?:           string
  tags?:            string
  notes?:           string
}

// Mapping completo = padrão + customizados (field_key → coluna CSV)
export interface ColumnMapping extends StdColumnMapping {
  customFields?: Record<string, string>
}

// Tenta mapear automaticamente cabeçalhos do CSV → campos padrão do CRM
export function autoDetectStdMapping(headers: string[]): StdColumnMapping {
  const patterns: Record<keyof StdColumnMapping, RegExp> = {
    name:            /^(nome|name|lead|cliente|paciente)/i,
    company_name:    /^(empresa|company|clinic|negoci|raz[aã]o|raz[aã]o social|organiza)/i,
    phone:           /^(telefone|phone|tel|celular|whatsapp|fone)/i,
    email:           /^(email|e-?mail)/i,
    status:          /^(status|situa[çc][aã]o|estado)/i,
    source:          /^(origem|source|fonte)/i,
    source_campaign: /^(campanha|campaign|an[uú]ncio|ad)/i,
    channel:         /^(canal|channel)/i,
    value:           /^(valor|value|pre[çc]o|amount|ticket)/i,
    tags:            /^(tags|etiquetas|categorias|marcadores)/i,
    notes:           /^(obs|observa|nota|note|comment|anota[çc]|coment)/i,
  }

  const mapping: StdColumnMapping = {}
  for (const header of headers) {
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(header) && !mapping[field as keyof StdColumnMapping]) {
        mapping[field as keyof StdColumnMapping] = header
      }
    }
  }
  return mapping
}

// Auto-detecta mapeamento de campos customizados — match pelo label da pergunta
export function autoDetectCustomMapping(
  headers: string[],
  fields:  LeadFieldDefinition[],
): Record<string, string> {
  const result: Record<string, string> = {}
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  for (const f of fields) {
    const fieldLabel = normalize(f.label)
    const match = headers.find((h) => normalize(h) === fieldLabel)
    if (match) result[f.field_key] = match
  }
  return result
}

function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return { headers: result.meta.fields ?? [], rows: result.data }
}

// Extrai sheetId e gid de qualquer formato de URL do Google Sheets
function parseSheetsUrl(url: string): { sheetId: string; gid: string; publicado: boolean } {
  // Aceita /spreadsheets/d/ID/edit, /preview, /view, /pub, etc.
  // O `e/` é capturado à parte porque MUDA o caminho: planilha publicada na
  // web vive em /d/e/<id>, e remontar sem o `e/` dá 404. Era esse o motivo de
  // um link que funciona colado no navegador não funcionar aqui.
  const idMatch = url.match(/\/spreadsheets\/d\/(e\/)?([a-zA-Z0-9-_]+)/)
  if (!idMatch) throw new Error('URL do Google Sheets inválida. Cole o link completo da planilha.')
  const publicado = !!idMatch[1]
  const sheetId = idMatch[2]
  // gid pode aparecer em #gid=, ?gid= ou &gid=
  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'
  return { sheetId, gid, publicado }
}

// Gera múltiplas URLs de export pra tentar em fallback
export function buildSheetsCsvUrls(url: string): string[] {
  const { sheetId, gid, publicado } = parseSheetsUrl(url)

  /* Se a pessoa já colou um link que devolve CSV (o "Publicar na web" entrega
     um pronto), usar como veio é o caminho mais curto e o único que não pode
     estar errado — remontar a URL só cria oportunidade de errar. */
  const jaEhCsv = /[?&](output|format)=csv/i.test(url)
  const base = publicado
    ? `https://docs.google.com/spreadsheets/d/e/${sheetId}`
    : `https://docs.google.com/spreadsheets/d/${sheetId}`

  const candidatos: string[] = []
  if (jaEhCsv) candidatos.push(url)

  if (publicado) {
    // Planilha publicada só responde no /pub; export e gviz dão 404 nela.
    candidatos.push(`${base}/pub?gid=${gid}&single=true&output=csv`)
  } else {
    candidatos.push(
      `${base}/export?format=csv&gid=${gid}`,
      `${base}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `${base}/pub?gid=${gid}&single=true&output=csv`,
    )
  }
  return [...new Set(candidatos)]
}


// Compat: ainda exporta o nome antigo
export function sheetsUrlToCsvUrl(url: string): string {
  return buildSheetsCsvUrls(url)[0]
}

// Tenta cada URL até uma retornar CSV válido (não HTML de erro)
async function fetchSheetsCsv(url: string): Promise<string> {
  const candidates = buildSheetsCsvUrls(url)
  const errors: string[] = []

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { redirect: 'follow' })
      if (!response.ok) {
        errors.push(`${response.status} em ${shortUrl(candidate)}`)
        continue
      }
      const text = await response.text()
      // Detecta HTML de erro (página de login do Google ou "not found")
      if (text.trim().toLowerCase().startsWith('<!doctype') ||
          text.trim().toLowerCase().startsWith('<html')) {
        errors.push('A planilha não está pública')
        continue
      }
      if (!text.trim()) {
        errors.push('Planilha vazia')
        continue
      }
      return text
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  /* "Failed to fetch" em TODAS as tentativas não é problema de
     compartilhamento: é o navegador barrando a saída antes de a requisição
     existir. Culpar o compartilhamento aqui mandou o usuário revisar a
     planilha três vezes enquanto o bloqueio era do lado do site. */
  const bloqueado = errors.length > 0 && errors.every((e) => /failed to fetch|networkerror/i.test(e))

  if (bloqueado) {
    throw new Error(
      'O navegador bloqueou o acesso ao Google Sheets. Isso é configuração do site, ' +
      'não da sua planilha — avise o suporte. ' +
      'Enquanto isso, baixe a planilha como CSV e use a opção de arquivo.',
    )
  }

  throw new Error(
    'Não consegui ler a planilha. ' +
    'Garanta que ela está com "Qualquer pessoa com o link pode visualizar" no compartilhamento. ' +
    `Tentei: ${errors.join(' · ')}`,
  )
}

function shortUrl(u: string): string {
  try { return new URL(u).pathname.split('/').slice(-2).join('/') } catch { return u.slice(0, 30) }
}

// ── Parsers de valor por tipo ────────────────────────────────────────────────

function parseStatus(raw: string | undefined): LeadStatus | undefined {
  if (!raw) return undefined
  const s = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (['ativo', 'active'].includes(s))                          return 'active'
  if (['convertido', 'converted', 'fechado', 'won'].includes(s)) return 'converted'
  if (['perdido', 'lost', 'declinou'].includes(s))               return 'lost'
  if (['arquivado', 'archived'].includes(s))                     return 'archived'
  return undefined
}

function parseSource(raw: string | undefined): LeadSource | undefined {
  if (!raw) return undefined
  const s = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (['manual'].includes(s))                            return 'manual'
  if (['import', 'importado', 'importacao'].includes(s)) return 'import'
  if (['meta_ads', 'meta', 'facebook', 'instagram', 'meta ads'].includes(s)) return 'meta_ads'
  if (['google', 'google ads', 'google_ads'].includes(s)) return 'google'
  if (['referral', 'indicacao', 'indicação'].includes(s)) return 'referral'
  if (['other', 'outro', 'outros'].includes(s))           return 'other'
  return undefined
}

function parseValue(raw: string | undefined): number | null {
  if (!raw) return null
  // Aceita "R$ 1.500,50", "1500,50", "1500.50", "1500"
  const cleaned = raw
    .replace(/[^\d.,-]/g, '')   // remove R$, espaços, etc
    .replace(/\.(?=\d{3})/g, '') // remove separadores de milhar (1.500 → 1500)
    .replace(',', '.')           // vírgula decimal → ponto
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
}

function parseCustomValue(raw: string | undefined, def: LeadFieldDefinition): unknown {
  if (raw == null || raw === '') return null
  const s = raw.trim()

  switch (def.field_type) {
    case 'boolean': {
      const norm = s.toLowerCase()
      if (['sim', 's', 'yes', 'y', 'true', '1', 'verdadeiro'].includes(norm)) return true
      if (['nao', 'não', 'n', 'no', 'false', '0', 'falso'].includes(norm))    return false
      return null
    }
    case 'number': {
      const n = parseFloat(s.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    default:
      return s
  }
}

// Resolve o channel_id pelo nome (case-insensitive, normalizado)
function resolveChannelId(
  raw:      string | undefined,
  channels: Array<{ id: string; name: string }>,
): string | null {
  if (!raw) return null
  const target = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!target) return null
  const found = channels.find((c) =>
    c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === target,
  )
  return found?.id ?? null
}

// Converte linhas do CSV em payload de import usando o mapeamento completo
function mapRowsToLeads(
  rows:         CsvRow[],
  mapping:      ColumnMapping,
  channels:     Array<{ id: string; name: string }>,
  customDefs:   LeadFieldDefinition[],
): ImportLeadRow[] {
  const results: ImportLeadRow[] = []

  for (const row of rows) {
    const name = mapping.name ? row[mapping.name]?.trim() : ''
    if (!name) continue

    const status = parseStatus(mapping.status ? row[mapping.status] : undefined)
    const source = parseSource(mapping.source ? row[mapping.source] : undefined) ?? 'import'
    const value  = parseValue (mapping.value  ? row[mapping.value]  : undefined)
    const tags   = parseTags  (mapping.tags   ? row[mapping.tags]   : undefined)
    const channel_id = resolveChannelId(mapping.channel ? row[mapping.channel] : undefined, channels)

    // Custom fields
    const custom_fields: Record<string, unknown> = {}
    if (mapping.customFields) {
      for (const def of customDefs) {
        const csvCol = mapping.customFields[def.field_key]
        if (!csvCol) continue
        const parsed = parseCustomValue(row[csvCol], def)
        if (parsed != null) custom_fields[def.field_key] = parsed
      }
    }

    results.push({
      name,
      company_name:    mapping.company_name    ? row[mapping.company_name]?.trim()    || undefined : undefined,
      phone:           mapping.phone           ? row[mapping.phone]?.trim()           || undefined : undefined,
      email:           mapping.email           ? row[mapping.email]?.trim()           || undefined : undefined,
      status,
      source,
      source_campaign: mapping.source_campaign ? row[mapping.source_campaign]?.trim() || undefined : undefined,
      notes:           mapping.notes           ? row[mapping.notes]?.trim()           || undefined : undefined,
      channel_id,
      value,
      tags,
      custom_fields:   Object.keys(custom_fields).length > 0 ? custom_fields : undefined,
    })
  }

  return results
}

// ── Hook principal ──────────────────────────────────────────────────────────

export function useLeadImport() {
  const queryClient = useQueryClient()
  const tenantId    = useAuthStore((s) => s.tenant?.id)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows,    setCsvRows]    = useState<CsvRow[]>([])
  const [mapping,    setMapping]    = useState<ColumnMapping>({})
  const [parseError, setParseError] = useState<string | null>(null)
  const [channels,    setChannels]   = useState<Array<{ id: string; name: string }>>([])
  const [customDefs, setCustomDefs] = useState<LeadFieldDefinition[]>([])

  // Carrega canais e definições de campos custom uma vez
  useEffect(() => {
    if (!tenantId) return
    Promise.all([
      supabase.from('lead_channels').select('id, name').eq('tenant_id', tenantId),
      fetchLeadFields(tenantId),
    ]).then(([chRes, defs]) => {
      setChannels((chRes.data ?? []) as Array<{ id: string; name: string }>)
      setCustomDefs(defs.filter((d) => d.active))
    }).catch(() => {/* silencioso */})
  }, [tenantId])

  const reset = useCallback(() => {
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setParseError(null)
  }, [])

  /* Devolve se conseguiu ler. Quem chama NÃO pode olhar `parseError` logo
     depois: aquele valor é o do render anterior, e na primeira tentativa vale
     sempre null — a tela avançava pro mapeamento mesmo com a leitura falhada,
     mostrando zero coluna e zero linha, e o erro nunca aparecia porque a tela
     já tinha saído daquele passo. Era o "coloco o link e não puxa nada". */
  async function loadFromFile(file: File): Promise<boolean> {
    setParseError(null)
    try {
      const text = await file.text()
      const { headers, rows } = parseCsvText(text)
      if (headers.length === 0) throw new Error('Não encontrei cabeçalhos na primeira linha do arquivo.')
      if (rows.length === 0)    throw new Error('O arquivo tem cabeçalho mas nenhuma linha de dados.')
      setCsvHeaders(headers)
      setCsvRows(rows)
      setMapping({
        ...autoDetectStdMapping(headers),
        customFields: autoDetectCustomMapping(headers, customDefs),
      })
      return true
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro desconhecido')
      return false
    }
  }

  async function loadFromSheetsUrl(url: string): Promise<boolean> {
    setParseError(null)
    try {
      const text = await fetchSheetsCsv(url)
      const { headers, rows } = parseCsvText(text)
      if (headers.length === 0) {
        throw new Error('Não consegui detectar colunas na planilha. Verifique se a primeira linha contém os cabeçalhos.')
      }
      // Planilha só com cabeçalho passava adiante e virava um mapeamento vazio,
      // que é indistinguível de "não funcionou".
      if (rows.length === 0) {
        throw new Error('A planilha tem cabeçalhos mas nenhuma linha de dados abaixo deles.')
      }
      setCsvHeaders(headers)
      setCsvRows(rows)
      setMapping({
        ...autoDetectStdMapping(headers),
        customFields: autoDetectCustomMapping(headers, customDefs),
      })
      return true
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro desconhecido')
      return false
    }
  }

  const importMutation = useMutation({
    mutationFn: () => {
      const rows = mapRowsToLeads(csvRows, mapping, channels, customDefs)
      if (rows.length === 0) throw new Error('Nenhuma linha válida para importar.')
      return importLeads(tenantId!, rows)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', tenantId] })
      reset()
    },
  })

  const previewRows = mapRowsToLeads(csvRows, mapping, channels, customDefs).slice(0, 5)
  const totalRows   = mapRowsToLeads(csvRows, mapping, channels, customDefs).length

  // Quantos campos do mapping foram preenchidos
  const mappedCount =
    Object.entries(mapping).filter(([k, v]) => k !== 'customFields' && !!v).length +
    Object.values(mapping.customFields ?? {}).filter(Boolean).length

  return {
    csvHeaders,
    csvRows,
    mapping,
    setMapping,
    parseError,
    previewRows,
    totalRows,
    mappedCount,
    customDefs,
    loadFromFile,
    loadFromSheetsUrl,
    importMutation,
    reset,
  }
}
