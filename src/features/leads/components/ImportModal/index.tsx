import { useState, useRef } from 'react'
import { Upload, Link2, ArrowRight, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useLeadImport, type ColumnMapping } from '../../hooks/useLeadImport'

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

type Step = 'source' | 'mapping' | 'confirm'
type SourceType = 'file' | 'sheets'

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  name:            'Nome *',
  phone:           'Telefone',
  email:           'E-mail',
  source:          'Origem',
  source_campaign: 'Campanha',
  notes:           'Observações',
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [step, setStep] = useState<Step>('source')
  const [sourceType, setSourceType] = useState<SourceType>('file')
  const [sheetsUrl, setSheetsUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    csvHeaders,
    mapping,
    setMapping,
    parseError,
    previewRows,
    totalRows,
    loadFromFile,
    loadFromSheetsUrl,
    importMutation,
    reset,
  } = useLeadImport()

  function handleClose() {
    setStep('source')
    setSheetsUrl('')
    reset()
    onClose()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await loadFromFile(file)
    setStep('mapping')
  }

  async function handleLoadSheets() {
    if (!sheetsUrl.trim()) return
    await loadFromSheetsUrl(sheetsUrl.trim())
    if (!parseError) setStep('mapping')
  }

  async function handleImport() {
    await importMutation.mutateAsync()
    setStep('confirm')
  }

  const headerOptions = [
    { value: '', label: '— não importar —' },
    ...csvHeaders.map((h) => ({ value: h, label: h })),
  ]

  const canProceedToPreview = !!mapping.name

  // ── Etapa 1: Escolher fonte ───────────────────────────────────────────────
  const stepSource = (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 p-1 gap-1">
        {(['file', 'sheets'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSourceType(type)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
              sourceType === type
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {type === 'file' ? <Upload size={16} /> : <Link2 size={16} />}
            {type === 'file' ? 'Arquivo CSV' : 'Google Sheets'}
          </button>
        ))}
      </div>

      {sourceType === 'file' ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors p-10 flex flex-col items-center gap-3 group"
          >
            <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Upload size={24} className="text-slate-400 group-hover:text-blue-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">Clique para selecionar um arquivo CSV</p>
              <p className="text-xs text-slate-400 mt-1">Exportado do Google Sheets, Excel ou outro CRM</p>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">Como usar o Google Sheets</p>
            <ol className="list-decimal ml-4 space-y-1 text-xs">
              <li>Abra a planilha no Google Sheets</li>
              <li>Clique em <strong>Arquivo → Compartilhar → Publicar na web</strong></li>
              <li>Selecione a aba e formato <strong>CSV</strong> e publique</li>
              <li>Cole a URL abaixo <em>(qualquer URL da planilha funciona)</em></li>
            </ol>
          </div>

          <Input
            label="URL da planilha"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
          />

          {parseError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{parseError}</p>
            </div>
          )}

          <Button onClick={handleLoadSheets} loading={importMutation.isPending} className="w-full">
            <ArrowRight size={16} />
            Carregar planilha
          </Button>
        </div>
      )}
    </div>
  )

  // ── Etapa 2: Mapeamento de colunas ────────────────────────────────────────
  const stepMapping = (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
        <strong>{csvHeaders.length}</strong> colunas detectadas ·{' '}
        <strong>{totalRows}</strong> linhas válidas para importar
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-slate-700">
          Mapeie as colunas do seu arquivo para os campos do CRM:
        </p>

        {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => (
          <div key={field} className="grid grid-cols-2 gap-3 items-center">
            <span className="text-sm text-slate-600">{FIELD_LABELS[field]}</span>
            <Select
              value={mapping[field] ?? ''}
              onChange={(e) =>
                setMapping({ ...mapping, [field]: e.target.value || undefined })
              }
              options={headerOptions}
              aria-label={`Mapear ${FIELD_LABELS[field]}`}
            />
          </div>
        ))}
      </div>

      {/* Preview das primeiras 5 linhas */}
      {previewRows.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
            Preview (primeiras {previewRows.length} linhas)
          </p>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Nome</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Telefone</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">E-mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-slate-700">{row.name}</td>
                    <td className="px-3 py-2 text-slate-500">{row.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{row.email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={() => setStep('source')}>Voltar</Button>
        <Button
          className="flex-1"
          disabled={!canProceedToPreview || totalRows === 0}
          onClick={() => setStep('confirm')}
        >
          Continuar ({totalRows} leads)
        </Button>
      </div>
    </div>
  )

  // ── Etapa 3: Confirmação / Resultado ──────────────────────────────────────
  const stepConfirm = (
    <div className="flex flex-col gap-5">
      {importMutation.isSuccess ? (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">Importação concluída!</p>
            <p className="text-sm text-slate-500 mt-1">
              <strong>{totalRows}</strong> leads foram importados com sucesso.
            </p>
          </div>
          <Button onClick={handleClose}>Fechar</Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Confirmar importação</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Você está prestes a importar <strong>{totalRows} leads</strong>. Esta ação não pode ser desfeita em massa.
              </p>
            </div>
          </div>

          {importMutation.error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>Erro na importação: {(importMutation.error as Error).message}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep('mapping')}>Voltar</Button>
            <Button
              className="flex-1"
              loading={importMutation.isPending}
              onClick={handleImport}
            >
              <RefreshCw size={16} />
              Importar {totalRows} leads
            </Button>
          </div>
        </>
      )}
    </div>
  )

  const STEP_TITLES: Record<Step, string> = {
    source:  'Importar Leads',
    mapping: 'Mapear Colunas',
    confirm: 'Confirmar Importação',
  }

  const STEP_DESCS: Record<Step, string> = {
    source:  'Escolha a origem dos dados',
    mapping: 'Relacione as colunas do arquivo aos campos do CRM',
    confirm: 'Revise e confirme antes de importar',
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={STEP_TITLES[step]}
      description={STEP_DESCS[step]}
      size="md"
    >
      {/* Indicador de etapas */}
      <div className="flex items-center gap-2 mb-6">
        {(['source', 'mapping', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : ['mapping', 'confirm'].indexOf(step) > ['mapping', 'confirm'].indexOf(s) || (step === 'confirm' && s !== 'confirm')
                  ? 'bg-green-100 text-green-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-slate-200 w-8" />}
          </div>
        ))}
      </div>

      {step === 'source'  && stepSource}
      {step === 'mapping' && stepMapping}
      {step === 'confirm' && stepConfirm}
    </Modal>
  )
}
