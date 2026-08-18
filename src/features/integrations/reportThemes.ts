import type { CSSProperties } from 'react'

/**
 * Temas do relatório impresso.
 *
 * O relatório sai da mão do gestor pro cliente dele — num sistema white
 * label, ele não pode ter a cara de quem construiu o software. Por isso a
 * escolha é dividida em duas: a COR (identidade da marca) e o ESTILO
 * (personalidade do documento). Seis cores × quatro estilos.
 */

export type CorTema = 'verde' | 'azul' | 'roxo' | 'vinho' | 'laranja' | 'grafite'
export type EstiloTema = 'elegante' | 'tecnologico' | 'minimalista' | 'corporativo'

export const CORES: { key: CorTema; label: string; hex: string }[] = [
  { key: 'verde',   label: 'Verde',   hex: '#0f9d58' },
  { key: 'azul',    label: 'Azul',    hex: '#1a73e8' },
  { key: 'roxo',    label: 'Roxo',    hex: '#6d28d9' },
  { key: 'vinho',   label: 'Vinho',   hex: '#9f1239' },
  { key: 'laranja', label: 'Laranja', hex: '#c2410c' },
  { key: 'grafite', label: 'Grafite', hex: '#334155' },
]

export const ESTILOS: { key: EstiloTema; label: string; desc: string }[] = [
  { key: 'elegante',    label: 'Elegante',     desc: 'Serifado, espaçado, sóbrio' },
  { key: 'tecnologico', label: 'Tecnológico',  desc: 'Faixa sólida, tabela em blocos' },
  { key: 'minimalista', label: 'Minimalista',  desc: 'Só o essencial, muito branco' },
  { key: 'corporativo', label: 'Corporativo',  desc: 'Clássico, bordas completas' },
]

export interface EstilosRelatorio {
  pagina:        CSSProperties
  cabecalho:     CSSProperties
  titulo:        CSSProperties
  subtitulo:     CSSProperties
  marca:         CSSProperties
  secaoTitulo:   CSSProperties
  comentario:    CSSProperties
  tabela:        CSSProperties
  th:            CSSProperties
  td:            CSSProperties
  linhaPar:      CSSProperties
  linhaTotal:    CSSProperties
  rodape:        CSSProperties
}

function hexParaRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function montarEstilos(cor: CorTema, estilo: EstiloTema): EstilosRelatorio {
  const accent = CORES.find((c) => c.key === cor)?.hex ?? '#0f9d58'

  const serif = 'Georgia, "Times New Roman", serif'
  const sans  = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  const mono  = '"SF Mono", "Cascadia Mono", Consolas, monospace'

  const base: EstilosRelatorio = {
    pagina:      { background: '#fff', color: '#111', fontFamily: sans },
    cabecalho:   { paddingBottom: 12, marginBottom: 18, borderBottom: `2px solid ${accent}` },
    titulo:      { fontSize: 21, fontWeight: 700, margin: 0, color: '#111', letterSpacing: '-0.01em' },
    subtitulo:   { fontSize: 11, color: '#666', margin: '6px 0 0' },
    marca:       { fontSize: 12, fontWeight: 700, color: accent, margin: '0 0 4px', letterSpacing: '0.04em' },
    secaoTitulo: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', margin: '0 0 7px', fontWeight: 600 },
    comentario:  { fontSize: 12.5, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap', color: '#222' },
    tabela:      { width: '100%', borderCollapse: 'collapse', fontSize: 10 },
    th:          { padding: '7px 5px', fontWeight: 600, color: '#444', borderBottom: `1.5px solid ${accent}` },
    td:          { padding: '6px 5px', borderBottom: '1px solid #eee' },
    linhaPar:    {},
    linhaTotal:  { fontWeight: 700, borderTop: `2px solid ${accent}`, background: hexParaRgba(accent, 0.06) },
    rodape:      { marginTop: 22, paddingTop: 10, borderTop: '1px solid #e5e5e5', fontSize: 9, color: '#999' },
  }

  switch (estilo) {
    case 'elegante':
      return {
        ...base,
        pagina:    { ...base.pagina, fontFamily: serif },
        cabecalho: { ...base.cabecalho, borderBottom: '1px solid #ccc', paddingBottom: 16, marginBottom: 24 },
        titulo:    { ...base.titulo, fontFamily: serif, fontSize: 25, fontWeight: 400, letterSpacing: '0.01em' },
        marca:     { ...base.marca, fontWeight: 400, letterSpacing: '0.22em', textTransform: 'uppercase', fontSize: 10 },
        th:        { ...base.th, borderBottom: '1px solid #999', color: '#555', fontWeight: 600, fontStyle: 'italic' },
        td:        { ...base.td, borderBottom: '1px solid #f0f0f0' },
        linhaTotal:{ fontWeight: 700, borderTop: '1px solid #999', background: 'transparent' },
      }

    case 'tecnologico':
      return {
        ...base,
        pagina:    { ...base.pagina, fontFamily: mono },
        // Faixa sólida: o único lugar onde a cor domina, pra não gastar
        // tinta com fundo colorido na tabela inteira.
        cabecalho: { background: accent, color: '#fff', padding: '16px 18px', marginBottom: 18, borderBottom: 'none' },
        titulo:    { fontSize: 19, fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' },
        subtitulo: { fontSize: 10, color: 'rgba(255,255,255,0.85)', margin: '6px 0 0' },
        marca:     { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: '0 0 4px', letterSpacing: '0.18em', textTransform: 'uppercase' },
        th:        { ...base.th, background: '#f1f5f9', color: '#334155', borderBottom: `2px solid ${accent}`, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.05em' },
        td:        { ...base.td, borderBottom: '1px solid #eef2f7' },
        linhaPar:  { background: '#fafbfc' },
        linhaTotal:{ fontWeight: 700, borderTop: `2px solid ${accent}`, background: hexParaRgba(accent, 0.1) },
      }

    case 'minimalista':
      return {
        ...base,
        cabecalho: { paddingBottom: 10, marginBottom: 22, borderBottom: '1px solid #e5e5e5' },
        titulo:    { ...base.titulo, fontSize: 18, fontWeight: 600 },
        marca:     { fontSize: 10, fontWeight: 500, color: '#999', margin: '0 0 3px', letterSpacing: '0.1em', textTransform: 'uppercase' },
        secaoTitulo: { ...base.secaoTitulo, color: '#aaa' },
        th:        { padding: '6px 5px', fontWeight: 500, color: '#999', borderBottom: '1px solid #e5e5e5', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em' },
        td:        { padding: '6px 5px', borderBottom: '1px solid #f5f5f5' },
        // Só o total recebe cor — é o número que interessa.
        linhaTotal:{ fontWeight: 600, borderTop: `1px solid ${accent}`, background: 'transparent', color: accent },
        rodape:    { ...base.rodape, borderTop: '1px solid #f0f0f0' },
      }

    case 'corporativo':
    default:
      return {
        ...base,
        th:  { ...base.th, background: hexParaRgba(accent, 0.08), border: '1px solid #d8d8d8', color: '#333' },
        td:  { padding: '6px 5px', border: '1px solid #e8e8e8' },
        linhaTotal: { fontWeight: 700, background: hexParaRgba(accent, 0.12), border: `1px solid ${accent}` },
      }
  }
}
