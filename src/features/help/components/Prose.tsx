import type { ReactNode } from 'react'

/* Blocos de formatação das respostas da Central de Ajuda. Ficam separados do
   conteúdo (data.tsx) porque lá o que se exporta são dados, não componentes. */

export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{children}</p>
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2 pl-5 list-decimal text-sm" style={{ color: 'var(--text)' }}>
      {items.map((it, i) => <li key={i} className="leading-relaxed">{it}</li>)}
    </ol>
  )
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-5 list-disc text-sm" style={{ color: 'var(--text)' }}>
      {items.map((it, i) => <li key={i} className="leading-relaxed">{it}</li>)}
    </ul>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed"
      style={{ background: 'rgba(64,160,255,0.06)', border: '1px solid rgba(64,160,255,0.2)', color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-lg px-3 py-2.5 text-xs overflow-x-auto"
      style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)', color: 'var(--text)' }}>
      <code>{children}</code>
    </pre>
  )
}

/** Tabelinha de 2 colunas — usada pra comparar conceitos lado a lado. */
export function Table({ head, rows }: { head: [string, string]; rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'var(--bg-surface2)' }}>
            <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{head[0]}</th>
            <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-dim)' }}>
              <td className="px-3 py-2 align-top" style={{ color: 'var(--text)' }}>{a}</td>
              <td className="px-3 py-2 align-top leading-relaxed" style={{ color: 'var(--text-muted)' }}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
