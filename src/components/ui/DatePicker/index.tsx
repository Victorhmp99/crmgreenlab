import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DatePickerProps {
  value:        string  // 'yyyy-mm-dd' ou ''
  onChange:     (value: string) => void
  label?:       string
  placeholder?: string
  className?:   string
  minDate?:     string
  clearable?:   boolean
  error?:       string
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function parseDate(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplay(value: string): string {
  const d = parseDate(value)
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const DROPDOWN_WIDTH = 268
const DROPDOWN_HEIGHT = 330   // altura aproximada, pra decidir abrir pra cima

export function DatePicker({ value, onChange, label, placeholder = 'Selecionar...', className, minDate, clearable = true, error }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  // Coordenadas absolutas na viewport. O calendário é renderizado em portal
  // no <body>, então precisa saber onde o campo está — não pode se apoiar no
  // pai como um `position: absolute` faria.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const selected = parseDate(value)
  const [viewDate, setViewDate] = useState(() => selected ?? new Date())
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const min = parseDate(minDate ?? '')

  /**
   * Ao abrir: volta o calendário pro mês escolhido e calcula onde ele cabe.
   *
   * A posição é medida no clique porque depende do layout naquele instante —
   * e em coordenadas de viewport porque o calendário vive num portal. Antes
   * ele era `position: absolute` dentro do campo, e qualquer ancestral com
   * `overflow` (o painel do lead, por exemplo) o recortava pela metade.
   */
  function toggle() {
    if (open) { setOpen(false); return }
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return

    setViewDate(selected ?? new Date())

    // Encosta na direita da tela? Alinha pela direita do campo.
    const abririaFora = rect.left + DROPDOWN_WIDTH > window.innerWidth - 8
    const left = abririaFora
      ? Math.max(rect.right - DROPDOWN_WIDTH, 8)
      : rect.left

    // Sem espaço embaixo? Abre pra cima, em vez de vazar pelo rodapé.
    const cabeEmbaixo = rect.bottom + DROPDOWN_HEIGHT < window.innerHeight - 8
    const top = cabeEmbaixo
      ? rect.bottom + 6
      : Math.max(rect.top - DROPDOWN_HEIGHT - 6, 8)

    setPos({ top, left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    function handleClick(e: MouseEvent) {
      const alvo = e.target as Node
      // O calendário está fora da árvore do campo (portal), então checar só o
      // wrapper fecharia o menu no primeiro clique dentro dele.
      const dentroDoCampo = wrapperRef.current?.contains(alvo)
      const dentroDoCalendario = dropdownRef.current?.contains(alvo)
      if (!dentroDoCampo && !dentroDoCalendario) setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }

    // Rolar ou redimensionar deixaria o calendário parado no lugar errado,
    // já que a posição foi medida na abertura. Fechar é mais honesto do que
    // mostrar o menu deslocado do campo.
    function fechar() { setOpen(false) }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    window.addEventListener('resize', fechar)
    window.addEventListener('scroll', fechar, true)   // true: pega scroll de contêiner interno
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
      window.removeEventListener('resize', fechar)
      window.removeEventListener('scroll', fechar, true)
    }
  }, [open])

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true })
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
    if (cells.length >= 42) break
  }

  const today = new Date()

  function pick(d: Date) {
    onChange(toValue(d))
    setOpen(false)
  }

  return (
    <div className={`flex flex-col gap-1.5 relative ${className ?? ''}`} ref={wrapperRef}>
      {label && (
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted, #888)' }}>
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={toggle}
        className="h-10 w-full rounded-lg px-3 text-sm flex items-center gap-2 text-left transition-all"
        style={{
          background: '#1a1a1a',
          border: `1px solid ${error ? '#ff4444' : open ? 'var(--tenant-primary)' : '#2a2a2a'}`,
          color: value ? '#e8e8e8' : '#555',
        }}
      >
        <Calendar size={14} style={{ color: '#555', flexShrink: 0 }} />
        <span className="flex-1 truncate">{value ? formatDisplay(value) : placeholder}</span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            className="shrink-0 rounded p-0.5 transition-colors"
            style={{ color: '#555' }}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <div ref={dropdownRef} className="fixed z-[100] rounded-xl p-3 shadow-2xl"
          style={{
            background: '#141414', border: '1px solid #2a2a2a', width: DROPDOWN_WIDTH,
            top: pos.top, left: pos.left,
          }}>
          {/* Header: mês/ano + navegação */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#888' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium" style={{ color: '#e8e8e8' }}>
              {MONTH_NAMES[month][0].toUpperCase() + MONTH_NAMES[month].slice(1)} de {year}
            </span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#888' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="text-center text-[10px] font-medium uppercase" style={{ color: '#555' }}>
                {w}
              </span>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }, i) => {
              const isSelected = selected && sameDay(date, selected)
              const isToday    = sameDay(date, today)
              const disabled   = !!min && date < min
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(date)}
                  className="h-8 w-8 rounded-lg text-xs flex items-center justify-center transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{
                    background: isSelected ? 'var(--tenant-primary)' : 'transparent',
                    color:      isSelected ? '#000' : inMonth ? '#e8e8e8' : '#444',
                    fontWeight: isToday && !isSelected ? 700 : 400,
                    border:     isToday && !isSelected ? '1px solid var(--tenant-primary)' : '1px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!isSelected && !disabled) e.currentTarget.style.background = '#1e1e1e' }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
            {clearable ? (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                className="text-xs font-medium transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}>
                Limpar
              </button>
            ) : <span />}
            <button type="button" onClick={() => pick(today)}
              className="text-xs font-medium transition-colors" style={{ color: 'var(--tenant-primary)' }}>
              Hoje
            </button>
          </div>
        </div>,
        document.body,
      )}

      {error && <p className="text-xs" style={{ color: '#ff4444' }}>{error}</p>}
    </div>
  )
}
