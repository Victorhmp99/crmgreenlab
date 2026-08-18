import type { ReactNode } from 'react'
import type { EstilosRelatorio } from './theme'

/**
 * Tabela do relatório, no tema escolhido.
 *
 * A largura é garantida por construção: `table-layout: fixed` mais um
 * `colgroup` explícito. Sem isso a tabela estica com o conteúdo e a última
 * coluna sai cortada na direita da folha — foi exatamente o que aconteceu
 * na primeira versão do relatório de campanhas.
 */

export interface ColunaRelatorio<T> {
  chave:   string
  rotulo:  string
  align?:  'left' | 'right'
  /** Fatia da largura. Se omitido, divide o que sobra em partes iguais. */
  largura?: string
  celula:  (item: T) => ReactNode
  /** Rodapé da coluna. Vazio quando não faz sentido totalizar. */
  total?:  ReactNode
}

export function ReportTable<T>({ st, colunas, itens, chaveDoItem, rotuloTotal = 'Total' }: {
  st:          EstilosRelatorio
  colunas:     ColunaRelatorio<T>[]
  itens:       T[]
  chaveDoItem: (item: T) => string
  rotuloTotal?: string
}) {
  const semLargura = colunas.filter((c) => !c.largura).length
  const usada = colunas.reduce((soma, c) => soma + (c.largura ? parseFloat(c.largura) : 0), 0)
  const fatia = semLargura > 0 ? `${Math.max(100 - usada, 10) / semLargura}%` : undefined

  const temTotal = colunas.some((c) => c.total !== undefined)

  return (
    <table style={st.tabela}>
      <colgroup>
        {colunas.map((c) => <col key={c.chave} style={{ width: c.largura ?? fatia }} />)}
      </colgroup>

      <thead>
        <tr>
          {colunas.map((c) => (
            <th key={c.chave} style={{ ...st.th, textAlign: c.align ?? 'right' }}>{c.rotulo}</th>
          ))}
        </tr>
      </thead>

      <tbody>
        {itens.map((item, i) => (
          <tr key={chaveDoItem(item)} style={i % 2 === 1 ? st.linhaPar : undefined}>
            {colunas.map((c) => (
              <td key={c.chave} style={{ ...st.td, textAlign: c.align ?? 'right' }}>
                {c.celula(item)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>

      {temTotal && (
        <tfoot>
          <tr style={st.linhaTotal}>
            {colunas.map((c, i) => (
              <td key={c.chave} style={{ ...st.td, textAlign: i === 0 ? 'left' : (c.align ?? 'right') }}>
                {i === 0 ? rotuloTotal : (c.total ?? '')}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  )
}
