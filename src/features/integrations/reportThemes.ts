import type { CSSProperties } from 'react'

/**
 * Temas do relatório impresso.
 *
 * O relatório sai da mão do gestor pro cliente dele — num sistema white
 * label, ele não pode ter a cara de quem construiu o software. A escolha é
 * dividida em duas: a COR (identidade da marca) e o ESTILO (arquitetura do
 * documento). O estilo muda faixa de cabeçalho, rodapé, tipografia e o
 * tratamento da tabela — não só a cor de um detalhe.
 */

export type CorTema = 'verde' | 'azul' | 'roxo' | 'vinho' | 'laranja' | 'grafite'
export type EstiloTema = 'elegante' | 'tecnologico' | 'minimalista' | 'corporativo'

export const CORES: { key: CorTema; label: string; hex: string; escuro: string }[] = [
  { key: 'verde',   label: 'Verde',   hex: '#0f9d58', escuro: '#0a6b3c' },
  { key: 'azul',    label: 'Azul',    hex: '#1a73e8', escuro: '#0f4c9a' },
  { key: 'roxo',    label: 'Roxo',    hex: '#6d28d9', escuro: '#4c1d95' },
  { key: 'vinho',   label: 'Vinho',   hex: '#9f1239', escuro: '#6b0d27' },
  { key: 'laranja', label: 'Laranja', hex: '#c2410c', escuro: '#8a2d08' },
  { key: 'grafite', label: 'Grafite', hex: '#334155', escuro: '#1e293b' },
]

export const ESTILOS: { key: EstiloTema; label: string; desc: string }[] = [
  { key: 'corporativo', label: 'Corporativo', desc: 'Faixa sólida, tabela com bordas' },
  { key: 'elegante',    label: 'Elegante',    desc: 'Serifado, faixa clara, filetes' },
  { key: 'tecnologico', label: 'Tecnológico', desc: 'Bloco escuro, zebra, monoespaçada' },
  { key: 'minimalista', label: 'Minimalista', desc: 'Barra lateral, muito branco' },
]

export interface EstilosRelatorio {
  pagina:      CSSProperties
  cabecalho:   CSSProperties
  marca:       CSSProperties
  titulo:      CSSProperties
  subtitulo:   CSSProperties
  corpo:       CSSProperties
  secaoTitulo: CSSProperties
  comentario:  CSSProperties
  tabela:      CSSProperties
  th:          CSSProperties
  td:          CSSProperties
  linhaPar:    CSSProperties
  linhaTotal:  CSSProperties
  rodape:      CSSProperties
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const SERIF = 'Georgia, "Times New Roman", serif'
const SANS  = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const MONO  = '"SF Mono", "Cascadia Mono", Consolas, "Courier New", monospace'

/* Larguras/espaços comuns a todos: o que muda é tratamento, não o esqueleto. */
const TABELA_BASE: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 9.5,
  tableLayout: 'fixed',   // impede a tabela de esticar além da folha
}
const CELULA_BASE: CSSProperties = {
  padding: '5px 4px',
  overflowWrap: 'anywhere',   // nome longo quebra em vez de vazar
  wordBreak: 'normal',
}

export function montarEstilos(cor: CorTema, estilo: EstiloTema): EstilosRelatorio {
  const paleta = CORES.find((c) => c.key === cor) ?? CORES[0]
  const accent = paleta.hex
  const escuro = paleta.escuro

  switch (estilo) {
    /* ── Corporativo — faixa sólida no topo e no pé, tabela com bordas ── */
    case 'corporativo':
    default:
      return {
        pagina:      { background: '#fff', color: '#1a1a1a', fontFamily: SANS },
        cabecalho:   { background: accent, color: '#fff', padding: '18px 22px', marginBottom: 0 },
        marca:       { fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', margin: '0 0 5px' },
        titulo:      { fontSize: 21, fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.01em' },
        subtitulo:   { fontSize: 10.5, color: 'rgba(255,255,255,0.8)', margin: '6px 0 0' },
        corpo:       { padding: '20px 22px' },
        secaoTitulo: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: accent, margin: '0 0 8px', fontWeight: 700 },
        comentario:  { fontSize: 11.5, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', color: '#333',
                       background: rgba(accent, 0.05), padding: '12px 14px', borderLeft: `3px solid ${accent}` },
        tabela:      TABELA_BASE,
        th:          { ...CELULA_BASE, background: rgba(accent, 0.12), color: escuro, fontWeight: 700, border: `1px solid ${rgba(accent, 0.3)}`, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.03em' },
        td:          { ...CELULA_BASE, border: '1px solid #e4e4e4' },
        linhaPar:    { background: '#fafafa' },
        linhaTotal:  { fontWeight: 700, background: rgba(accent, 0.15), color: escuro },
        rodape:      { background: escuro, color: 'rgba(255,255,255,0.75)', padding: '10px 22px', fontSize: 8.5, marginTop: 0 },
      }

    /* ── Elegante — faixa clara tingida, serifas, filetes finos ── */
    case 'elegante':
      return {
        pagina:      { background: '#fff', color: '#1f1f1f', fontFamily: SERIF },
        cabecalho:   { background: rgba(accent, 0.07), color: '#1f1f1f', padding: '26px 26px 22px',
                       borderTop: `3px solid ${accent}`, borderBottom: `1px solid ${rgba(accent, 0.25)}` },
        marca:       { fontSize: 9.5, fontWeight: 400, letterSpacing: '0.3em', textTransform: 'uppercase', color: accent, margin: '0 0 10px', fontFamily: SANS },
        titulo:      { fontSize: 26, fontWeight: 400, margin: 0, color: '#1a1a1a', fontFamily: SERIF, letterSpacing: '0.01em' },
        subtitulo:   { fontSize: 10.5, color: '#6b6b6b', margin: '8px 0 0', fontStyle: 'italic' },
        corpo:       { padding: '22px 26px' },
        secaoTitulo: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', margin: '0 0 9px', fontWeight: 400, fontFamily: SANS },
        comentario:  { fontSize: 12, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap', color: '#2a2a2a', fontStyle: 'italic',
                       borderLeft: `2px solid ${rgba(accent, 0.4)}`, paddingLeft: 14 },
        tabela:      { ...TABELA_BASE, fontSize: 9 },
        th:          { ...CELULA_BASE, color: accent, fontWeight: 400, fontStyle: 'italic', borderBottom: `1px solid ${accent}`, fontSize: 9, fontFamily: SANS },
        td:          { ...CELULA_BASE, borderBottom: '1px solid #efefef' },
        linhaPar:    {},
        linhaTotal:  { fontWeight: 700, borderTop: `1px solid ${accent}`, borderBottom: `3px double ${accent}`, color: escuro },
        rodape:      { background: rgba(accent, 0.06), color: '#7a7a7a', padding: '12px 26px', fontSize: 8.5,
                       borderTop: `1px solid ${rgba(accent, 0.2)}`, fontStyle: 'italic', marginTop: 0 },
      }

    /* ── Tecnológico — bloco escuro, monoespaçada, zebra ── */
    case 'tecnologico':
      return {
        pagina:      { background: '#fff', color: '#0f172a', fontFamily: MONO },
        cabecalho:   { background: escuro, color: '#fff', padding: '20px 22px', borderBottom: `4px solid ${accent}` },
        marca:       { fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: accent, margin: '0 0 8px' },
        titulo:      { fontSize: 19, fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' },
        subtitulo:   { fontSize: 9.5, color: 'rgba(255,255,255,0.6)', margin: '7px 0 0' },
        corpo:       { padding: '20px 22px' },
        secaoTitulo: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: accent, margin: '0 0 8px', fontWeight: 700 },
        comentario:  { fontSize: 10.5, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap', color: '#1e293b',
                       background: '#f1f5f9', padding: '12px 14px', borderLeft: `3px solid ${accent}` },
        tabela:      { ...TABELA_BASE, fontSize: 8.5 },
        th:          { ...CELULA_BASE, background: escuro, color: '#fff', fontWeight: 700, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.04em' },
        td:          { ...CELULA_BASE, borderBottom: '1px solid #e8edf3' },
        linhaPar:    { background: '#f8fafc' },
        linhaTotal:  { fontWeight: 700, background: rgba(accent, 0.14), borderTop: `2px solid ${accent}`, color: escuro },
        rodape:      { background: '#0f172a', color: 'rgba(255,255,255,0.55)', padding: '11px 22px', fontSize: 8, marginTop: 0 },
      }

    /* ── Minimalista — barra lateral fina, quase sem cor ── */
    case 'minimalista':
      return {
        pagina:      { background: '#fff', color: '#111', fontFamily: SANS },
        cabecalho:   { background: '#fff', color: '#111', padding: '24px 24px 20px', borderLeft: `4px solid ${accent}`,
                       borderBottom: '1px solid #ededed' },
        marca:       { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, margin: '0 0 8px' },
        titulo:      { fontSize: 19, fontWeight: 600, margin: 0, color: '#111', letterSpacing: '-0.015em' },
        subtitulo:   { fontSize: 10, color: '#9a9a9a', margin: '7px 0 0' },
        corpo:       { padding: '22px 24px' },
        secaoTitulo: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#bbb', margin: '0 0 9px', fontWeight: 600 },
        comentario:  { fontSize: 11.5, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', color: '#333' },
        tabela:      { ...TABELA_BASE, fontSize: 9 },
        th:          { ...CELULA_BASE, color: '#aaa', fontWeight: 500, borderBottom: '1px solid #e8e8e8', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.05em' },
        td:          { ...CELULA_BASE, borderBottom: '1px solid #f6f6f6' },
        linhaPar:    {},
        linhaTotal:  { fontWeight: 600, borderTop: `2px solid ${accent}`, color: accent },
        rodape:      { background: '#fff', color: '#bbb', padding: '12px 24px', fontSize: 8,
                       borderTop: '1px solid #f0f0f0', borderLeft: `4px solid ${rgba(accent, 0.35)}`, marginTop: 0 },
      }
  }
}
