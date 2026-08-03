import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../Button'

export interface ConfirmOptions {
  title?:        string
  message:       ReactNode
  confirmLabel?: string
  cancelLabel?:  string
  danger?:       boolean               // botão de confirmar em vermelho (ação destrutiva)
  variant?:      'confirm' | 'alert'   // 'alert' = aviso com um botão só (sem cancelar)
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/* Diálogo estilizado no lugar do confirm()/alert() nativo do navegador.
   Global: <ConfirmProvider> envolve o app e um único modal é renderizado aqui.
   Uso: const confirm = useConfirm()
        if (!(await confirm({ message: 'Excluir?', danger: true }))) return
   Aviso (um botão): await confirm({ variant: 'alert', message: '...' }) */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }, [])

  const isAlert = opts?.variant === 'alert'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal
          open
          onClose={() => settle(false)}
          title={opts.title ?? (isAlert ? 'Aviso' : 'Confirmar ação')}
          size="sm"
          footer={
            <>
              {!isAlert && (
                <Button variant="ghost" onClick={() => settle(false)}>
                  {opts.cancelLabel ?? 'Cancelar'}
                </Button>
              )}
              <Button
                variant={opts.danger ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                autoFocus
              >
                {opts.confirmLabel ?? (isAlert ? 'Entendi' : 'Confirmar')}
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
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>')
  return ctx
}
