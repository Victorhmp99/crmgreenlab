import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Rede de proteção contra erro de render.
 *
 * Sem isto, UMA exceção em qualquer componente desmonta a árvore inteira e o
 * CRM vira uma tela preta — sem mensagem, sem botão, sem pista do que houve.
 * Foi o que aconteceu ao limpar a data em Relatórios: um rótulo de período
 * apagou o sistema todo.
 *
 * A causa daquele caso foi corrigida na raiz, mas ela não era especial. Todo
 * `.map` sobre algo que veio nulo, todo campo que a API parou de mandar, todo
 * formatador com entrada inesperada faz o mesmo estrago. Não dá pra enumerar
 * os que faltam; dá pra garantir que o próximo não apague a tela.
 *
 * Fica DENTRO dos provedores e em volta das rotas: assim o erro de uma tela
 * não derruba sessão nem tema, e recarregar volta pro mesmo lugar.
 */
interface Props { children: ReactNode }
interface State { erro: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Vai pro console do navegador porque é lá que se investiga depois. A
    // mensagem na tela é pra pessoa; esta é pra quem for consertar.
    console.error('[ErrorBoundary] erro de render:', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children

    return (
      <div className="flex items-center justify-center min-h-screen p-6"
        style={{ background: '#0d0d0d' }}>
        <div className="w-full max-w-md rounded-2xl p-6 text-center"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex justify-center mb-3">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,68,68,0.1)' }}>
              <AlertTriangle size={20} style={{ color: '#ff6666' }} />
            </div>
          </div>

          <h1 className="text-base font-semibold mb-1" style={{ color: '#e8e8e8' }}>
            Esta tela travou
          </h1>
          <p className="text-sm mb-4" style={{ color: '#888' }}>
            Nada foi perdido — o que estava salvo continua salvo. Recarregue pra continuar.
          </p>

          {/* O texto do erro fica visível de propósito: é o que a pessoa
              consegue mandar pra quem vai consertar. Escondê-lo transforma
              todo relato em "deu erro" e não ajuda ninguém. */}
          <p className="text-[11px] font-mono rounded-lg px-3 py-2 mb-4 break-all text-left"
            style={{ background: '#0d0d0d', color: '#7a5555' }}>
            {this.state.erro.message || String(this.state.erro)}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium transition-colors"
            style={{ background: '#00e676', color: '#0d0d0d' }}
          >
            <RefreshCw size={14} /> Recarregar
          </button>
        </div>
      </div>
    )
  }
}
