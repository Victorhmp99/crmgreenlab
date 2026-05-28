import { useState, useRef, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'

interface Props {
  pipelineName: string
  isPending?:   boolean
  onConfirm:    () => void | Promise<void>
  onClose:      () => void
}

const CONFIRM_PHRASE = 'excluir pipeline'

export function DeletePipelineModal({ pipelineName, isPending, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const isMatch = typed.trim().toLowerCase() === CONFIRM_PHRASE

  async function handleConfirm() {
    if (!isMatch || isPending) return
    await onConfirm()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={() => !isPending && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col gap-5 p-6"
        style={{
          background:  '#141414',
          border:      '1px solid rgba(255,68,68,0.3)',
          boxShadow:   '0 20px 60px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,68,68,0.12)' }}>
              <Trash2 size={16} style={{ color: '#ff4444' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#ff6666' }}>
                Excluir pipeline
              </h3>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>
                Esta ação é irreversível
              </p>
            </div>
          </div>
          <button
            onClick={() => !isPending && onClose()}
            disabled={isPending}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ color: '#555' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Aviso */}
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
          style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.15)' }}>
          <p className="text-sm" style={{ color: '#e8e8e8' }}>
            Você está prestes a excluir a pipeline{' '}
            <strong style={{ color: '#ff6666' }}>"{pipelineName}"</strong>.
          </p>
          <p className="text-xs" style={{ color: '#666' }}>
            Todas as etapas e cards desta pipeline serão removidos permanentemente.
            Os leads <strong style={{ color: '#888' }}>não</strong> serão excluídos.
          </p>
        </div>

        {/* Campo de confirmação */}
        <div className="flex flex-col gap-2">
          <label className="text-xs" style={{ color: '#666' }}>
            Para confirmar, digite{' '}
            <span className="font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ background: '#1e1e1e', color: '#ff4444' }}>
              {CONFIRM_PHRASE}
            </span>{' '}
            abaixo:
          </label>
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
            placeholder={CONFIRM_PHRASE}
            disabled={isPending}
            className="h-10 rounded-xl px-3 text-sm focus:outline-none transition-all disabled:opacity-50"
            style={{
              background:   '#111',
              border:       `1px solid ${isMatch ? 'rgba(255,68,68,0.5)' : '#2a2a2a'}`,
              color:        '#e8e8e8',
              caretColor:   '#ff4444',
            }}
          />
        </div>

        {/* Botões */}
        <div className="flex gap-2">
          <button
            onClick={() => !isPending && onClose()}
            disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            style={{ border: '1px solid #2a2a2a', color: '#666' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#666'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isMatch || isPending}
            className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-30"
            style={{
              background: isMatch ? 'rgba(255,68,68,0.15)' : '#1a1a1a',
              border:     isMatch ? '1px solid rgba(255,68,68,0.4)' : '1px solid #2a2a2a',
              color:      isMatch ? '#ff6666' : '#444',
            }}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin inline-block" />
                Excluindo...
              </span>
            ) : (
              'Excluir pipeline'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
