import type { Membro } from '@/services/boards'
import { CORES_QUADRO } from '@/services/boards'

/**
 * Texto com links clicáveis. O Victor pediu "se ele reconhece o link e deixa
 * clicável, sem ter que colocar link mesmo" — então qualquer http(s)://
 * ou www. vira âncora, o resto fica como foi escrito (quebras incluídas).
 */
// Pega http(s)://, www. e domínio puro com terminação conhecida (drive.google.com/x,
// notion.so/abc) — sem exigir o protocolo, que ninguém digita no dia a dia.
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]}"']|(?<![a-z0-9@.\/])(?:[a-z0-9-]+\.)+(?:com|br|net|org|io|app|co|dev|me|ai|so|link|site|online|store|shop|design|studio|tv|xyz)(?:\.[a-z]{2})?(?:\/[^\s<]*[^\s<.,;:!?)\]}"']|\/)?(?![a-z0-9@]))/gi

export function Linkify({ text, className }: { text: string; className?: string }) {
  const partes = text.split(URL_RE)
  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {partes.map((p, i) =>
        // split com grupo de captura alterna texto / link — ímpar é link
        i % 2 === 1
          ? <a key={i} href={p.startsWith('http') ? p : `https://${p}`} target="_blank" rel="noopener noreferrer"
               onClick={(e) => e.stopPropagation()}
               className="underline underline-offset-2 hover:opacity-80" style={{ color: '#40a0ff' }}>{p}</a>
          : <span key={i}>{p}</span>,
      )}
    </span>
  )
}

export function nomeDoMembro(m: Membro | undefined): string {
  return m?.full_name ?? m?.email ?? '?'
}

export function iniciais(nome: string): string {
  const partes = nome.replace(/@.*$/, '').trim().split(/[\s._-]+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Cor estável por pessoa, pra avatar sem foto. */
export function corDaPessoa(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CORES_QUADRO[h % CORES_QUADRO.length]
}

export function Avatar({ membro, id, size = 22, title }: { membro?: Membro; id: string; size?: number; title?: string }) {
  const nome = nomeDoMembro(membro)
  const cor  = corDaPessoa(id)
  return (
    <span title={title ?? nome}
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `${cor}33`, color: cor, border: `1px solid ${cor}66` }}>
      {iniciais(nome)}
    </span>
  )
}

export function Swatches({ value, onChange, allowNone = true, size = 22 }: {
  value: string | null; onChange: (c: string | null) => void; allowNone?: boolean; size?: number
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button type="button" onClick={() => onChange(null)} title="Sem cor"
          className="rounded-md flex items-center justify-center text-[10px]"
          style={{ width: size, height: size, border: `1px solid ${value === null ? '#e8e8e8' : '#333'}`, color: '#666' }}>
          ✕
        </button>
      )}
      {CORES_QUADRO.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className="rounded-md transition-transform hover:scale-110"
          style={{ width: size, height: size, background: c, outline: value === c ? '2px solid #e8e8e8' : 'none', outlineOffset: 1 }} />
      ))}
    </div>
  )
}

/** Hoje em São Paulo, 'yyyy-mm-dd' — comparar prazo com isto, não com toISOString (UTC). */
export function hojeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function prazoCurto(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
