import { useState, useRef } from 'react'
import { Upload, Link2, ArrowRight, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useLeadImport, type StdColumnMapping } from '../../hooks/useLeadImport'

interface ImportModalProps {
  open:    boolean
  onClose: () => void
}

type Step = 'source' | 'mapping' | 'confirm'
type SourceType = 'file' | 'sheets'

const FIELD_LABELS: Record<keyof StdColumnMapping, string> = {
  name:            'Nome *',
  company_name:    'Empresa',
  phone:           'Telefone',
  email:           'E-mail',
  status:          'Status (Ativo/Convertido/Perdido)',
  source:          'Origem',
  source_campaign: 'Campanha',
  channel:         'Canal',
  value:           'Valor (R$)',
  tags:            'Tags (separadas por vírgula)',
  notes:           'Observações',
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [step, setStep]             = useState<Step>('source')
  const [sourceType, setSourceType] = useState<SourceType>('file')
  const [sheetsUrl, setSheetsUrl]   = useState('')
  const fileInputRef                = useRef<HTMLInputElement>(null)

  const {
    csvHeaders, mapping, setMapping, parseError,
    previewRows, totalRows, mappedCount, customDefs,
    loadFromFile, loadFromSheetsUrl,
    importMutation, reset,
  } = useLeadImport()

  function handleClose() {
    setStep('source'); setSheetsUrl(''); reset(); onClose()
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

  // ── Etapa 1 ───────────────────────────────────────────────────────────────
  const stepSource = (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
        {(['file', 'sheets'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSourceType(type)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all"
            style={
              sourceType === type
                ? { background: 'var(--tenant-primary)', color: '#000' }
                : { color: '#555' }
            }
            onMouseEnter={(e) => { if (sourceType !== type) (e.currentTarget as HTMLButtonElement).style.color = '#aaa' }}
            onMouseLeave={(e) => { if (sourceType !== type) (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
          >
            {type === 'file' ? <Upload size={16} /> : <Link2 size={16} />}
            {type === 'file' ? 'Arquivo CSV' : 'Google Sheets'}
          </button>
        ))}
      </div>

      {sourceType === 'file' ? (
        <div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl p-10 flex flex-col items-center gap-3 group transition-all"
            style={{ border: '2px dashed #2a2a2a' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--tenant-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
          >
            <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: '#1a1a1a' }}>
              <Upload size={24} style={{ color: '#444' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: '#aaa' }}>Clique para selecionar um arquivo CSV</p>
              <p className="text-xs mt-1" style={{ color: '#555' }}>Exportado do Google Sheets, Excel ou outro CRM</p>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-4 text-sm"
            style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.15)', color: '#00c853' }}>
            <p className="font-medium mb-1">Como usar o Google Sheets</p>
            <ol className="list-decimal ml-4 space-y-1 text-xs" style={{ color: '#00a846' }}>
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
            <div className="flex items-start gap-2 text-sm rounded-lg px-3 py-2.5"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
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

  // ── Etapa 2 ───────────────────────────────────────────────────────────────
  const stepMapping = (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl px-4 py-3 text-sm"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa' }}>
        <strong style={{ color: '#e8e8e8' }}>{csvHeaders.length}</strong> colunas detectadas ·{' '}
        <strong style={{ color: '#e8e8e8' }}>{mappedCount}</strong> mapeadas automaticamente ·{' '}
        <strong style={{ color: '#e8e8e8' }}>{totalRows}</strong> linhas válidas
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium" style={{ color: '#aaa' }}>
          Mapeie as colunas do seu arquivo para os campos do CRM:
        </p>

        {/* Campos padrão */}
        <div className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#555' }}>
            Dados do Lead
          </p>
          {(Object.keys(FIELD_LABELS) as (keyof StdColumnMapping)[]).map((field) => (
            <div key={field} className="grid grid-cols-2 gap-3 items-center">
              <span className="text-sm" style={{ color: '#888' }}>{FIELD_LABELS[field]}</span>
              <Select
                value={mapping[field] ?? ''}
                onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || undefined })}
                options={headerOptions}
                aria-label={`Mapear ${FIELD_LABELS[field]}`}
              />
            </div>
          ))}
        </div>

        {/* Campos customizados (perguntas do formulário) */}
        {customDefs.length > 0 && (
          <div className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#555' }}>
              Perguntas do Formulário ({customDefs.length})
            </p>
            {customDefs.map((def) => (
              <div key={def.field_key} className="grid grid-cols-2 gap-3 items-center">
                <span className="text-sm truncate" style={{ color: '#888' }} title={def.label}>
                  {def.label}{def.required ? ' *' : ''}
                </span>
                <Select
                  value={mapping.customFields?.[def.field_key] ?? ''}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      customFields: {
                        ...(mapping.customFields ?? {}),
                        [def.field_key]: e.target.value || '',
                      },
                    })
                  }
                  options={headerOptions}
                  aria-label={`Mapear ${def.label}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {previewRows.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: '#555' }}>
            Preview (primeiras {previewRows.length} linhas)
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1e1e1e' }}>
            <table className="w-full text-xs">
              <thead style={{ background: '#111', borderBottom: '1px solid #1e1e1e' }}>
                <tr>
                  {['Nome', 'Telefone', 'E-mail'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: '#555' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #191919' }}>
                    <td className="px-3 py-2" style={{ color: '#e8e8e8' }}>{row.name}</td>
                    <td className="px-3 py-2" style={{ color: '#888' }}>{row.phone ?? '—'}</td>
                    <td className="px-3 py-2 truncate max-w-[120px]" style={{ color: '#888' }}>{row.email ?? '—'}</td>
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

  // ── Etapa 3 ───────────────────────────────────────────────────────────────
  const stepConfirm = (
    <div className="flex flex-col gap-5">
      {importMutation.isSuccess ? (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-14 w-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)' }}>
            <CheckCircle size={28} style={{ color: 'var(--tenant-primary)' }} />
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: '#e8e8e8' }}>Importação concluída!</p>
            <p className="text-sm mt-1" style={{ color: '#666' }}>
              <strong style={{ color: '#e8e8e8' }}>{totalRows}</strong> leads foram importados com sucesso.
            </p>
          </div>
          <Button onClick={handleClose}>Fechar</Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl p-5 flex items-start gap-3"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <AlertCircle size={20} className="shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>Confirmar importação</p>
              <p className="text-sm mt-0.5" style={{ color: '#aaa' }}>
                Você está prestes a importar <strong style={{ color: '#e8e8e8' }}>{totalRows} leads</strong>.
                Esta ação não pode ser desfeita em massa.
              </p>
            </div>
          </div>

          {importMutation.error && (
            <div className="flex items-start gap-2 text-sm rounded-lg px-3 py-2.5"
              style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>Erro na importação: {(importMutation.error as Error).message}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep('mapping')}>Voltar</Button>
            <Button className="flex-1" loading={importMutation.isPending} onClick={handleImport}>
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
    <Modal open={open} onClose={handleClose} title={STEP_TITLES[step]} description={STEP_DESCS[step]} size="md">
      {/* Indicador de etapas */}
      <div className="flex items-center gap-2 mb-6">
        {(['source', 'mapping', 'confirm'] as Step[]).map((s, i) => {
          const done = ['mapping', 'confirm'].indexOf(step) > ['mapping', 'confirm'].indexOf(s) || (step === 'confirm' && s !== 'confirm')
          const active = step === s
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                style={
                  active
                    ? { background: 'var(--tenant-primary)', color: '#000' }
                    : done
                    ? { background: 'rgba(0,230,118,0.15)', color: '#00e676' }
                    : { background: '#1a1a1a', color: '#444' }
                }
              >
                {i + 1}
              </div>
              {i < 2 && <div className="flex-1 h-px w-8" style={{ background: '#2a2a2a' }} />}
            </div>
          )
        })}
      </div>

      {step === 'source'  && stepSource}
      {step === 'mapping' && stepMapping}
      {step === 'confirm' && stepConfirm}
    </Modal>
  )
}
