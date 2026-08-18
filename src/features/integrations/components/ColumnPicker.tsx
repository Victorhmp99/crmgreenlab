import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, Check } from 'lucide-react'
import { SELECTABLE_COLUMNS, DEFAULT_COLUMNS, type ColumnKey } from '../metaColumns'
import { salvarColunas } from '../colunasSalvas'

/**
 * Escolha de quais métricas aparecem na tabela.
 */
export function ColumnPicker({ tenantId, selecionadas, onChange }: {
  tenantId:     string
  selecionadas: ColumnKey[]
  onChange:     (cols: ColumnKey[]) => void
}) {
  const [aberto, setAberto] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function clique(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', clique)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', clique)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  function alternar(key: ColumnKey) {
    const nova = selecionadas.includes(key)
      ? selecionadas.filter((k) => k !== key)
      : [...selecionadas, key]
    onChange(nova)
    salvarColunas(tenantId, nova)
  }

  function restaurarPadrao() {
    onChange(DEFAULT_COLUMNS)
    salvarColunas(tenantId, DEFAULT_COLUMNS)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="h-10 inline-flex items-center gap-2 rounded-lg px-3 text-sm transition-colors"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#c8c8c8' }}
        aria-expanded={aberto}
      >
        <SlidersHorizontal size={14} />
        Métricas
        <span className="text-xs tabular-nums" style={{ color: '#555' }}>{selecionadas.length}</span>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-2 z-30 rounded-xl p-2 w-60 max-h-[22rem] overflow-y-auto"
          style={{ background: '#141414', border: '1px solid #2a2a2a', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1.5" style={{ color: '#555' }}>
            Mostrar na tabela
          </p>

          {SELECTABLE_COLUMNS.map((col) => {
            const ativa = selecionadas.includes(col.key)
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => alternar(col.key)}
                className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="h-4 w-4 rounded flex items-center justify-center shrink-0"
                  style={{
                    background: ativa ? 'var(--tenant-primary)' : 'transparent',
                    border: `1px solid ${ativa ? 'var(--tenant-primary)' : '#3a3a3a'}`,
                  }}>
                  {ativa && <Check size={11} style={{ color: '#04120a' }} />}
                </span>
                <span className="min-w-0">
                  <span className="text-sm block" style={{ color: ativa ? '#e8e8e8' : '#999' }}>{col.label}</span>
                  {col.hint && <span className="text-[10px] block leading-snug" style={{ color: '#555' }}>{col.hint}</span>}
                </span>
              </button>
            )
          })}

          <button type="button" onClick={restaurarPadrao}
            className="w-full text-left text-xs px-2 py-2 mt-1 rounded-lg transition-colors"
            style={{ color: '#666', borderTop: '1px solid #1e1e1e' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}>
            Restaurar padrão
          </button>
        </div>
      )}
    </div>
  )
}
