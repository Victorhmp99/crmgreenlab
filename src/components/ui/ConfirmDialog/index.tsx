import { useState, useCallback, useRef, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../Button'

export interface ConfirmOptions {
  title?:        string
  message:       ReactNode
  confirmLabel?: string
  cancelLabel?:  string
  danger?:       boolean       // botão de confirmar em vermelho (ação destrutiva)
}

/* Confirmação estilizada no lugar do confirm() nativo do navegador.
   Uso: const { confirm, confirmElement } = useConfirm()
        if (!(await confirm({ message: '...', danger: true })) return
   e renderizar {confirmElement} no JSX do componente. */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }, [])

  const confirmElement = opts ? (
    <Modal
      open
      onClose={() => settle(false)}
      title={opts.title ?? 'Confirmar ação'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)}>
            {opts.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            variant={opts.danger ? 'danger' : 'primary'}
            onClick={() => settle(true)}
            autoFocus
          >
            {opts.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {opts.danger && (
          <span className="h-9 w-9 rounded-full shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(255,68,68,0.1)' }}>
            <AlertTriangle size={18} style={{ color: '#ff5555' }} />
          </span>
        )}
        <p className="text-sm leading-relaxed pt-1" style={{ color: '#bbb' }}>
          {opts.message}
        </p>
      </div>
    </Modal>
  ) : null

  return { confirm, confirmElement }
}
