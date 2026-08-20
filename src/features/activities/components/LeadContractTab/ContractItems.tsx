import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'
import { useFinancialProducts } from '@/features/revenue/hooks/useFinancialProducts'
import { formatCurrency } from '@/lib/utils'
import {
  fetchContractItems, addContractItem, updateContractItem, removeContractItem,
  itemTotal, itemsTotal, type ContractItem,
} from '@/services/contractItems'

/**
 * Produtos e serviços de um contrato.
 *
 * Isto é um REGISTRO do que foi vendido, não uma segunda fonte de valor. Quem
 * manda no faturamento é sempre o valor do contrato — os itens existem pra
 * responder "quais produtos mais saem" no relatório, não pra recalcular
 * quanto o contrato vale. O preço aqui é ilustrativo: útil como referência e
 * pra dividir o valor do contrato entre os itens quando há mais de um, mas
 * nunca precisa bater com o valor do contrato.
 *
 * Itens podem ser adicionados depois — é o caso de adicional vendido no meio
 * do contrato.
 */
export function ContractItems({ contractId }: {
  contractId: string
}) {
  const tenantId = useAuthStore((s) => s.tenant?.id)!
  const queryClient = useQueryClient()
  const { data: products = [] } = useFinancialProducts()

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['contract-items', contractId],
    queryFn:  () => fetchContractItems(contractId),
    enabled:  !!contractId,
  })

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['contract-items', contractId] })
  }

  const add = useMutation({
    mutationFn: (d: { product_id: string | null; description: string; unit_price: number; quantity: number }) =>
      addContractItem(tenantId, contractId, d),
    onSuccess: invalidar,
  })
  const upd = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContractItem> }) => updateContractItem(id, data),
    onSuccess: invalidar,
  })
  const del = useMutation({ mutationFn: removeContractItem, onSuccess: invalidar })

  const [editando, setEditando] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)

  const total = itemsTotal(itens)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Package size={13} style={{ color: '#666' }} />
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Produtos e serviços
          </span>
        </div>
        {!novoAberto && (
          <button type="button" onClick={() => setNovoAberto(true)}
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: 'var(--tenant-primary)' }}>
            <Plus size={12} /> Adicionar item
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : (
        <>
          {itens.length === 0 && !novoAberto && (
            <p className="text-xs" style={{ color: '#555' }}>
              Nenhum item ainda. Adicione o que foi vendido para o contrato deixar de ser
              só um valor.
            </p>
          )}

          {itens.map((item) => (
            editando === item.id ? (
              <ItemForm key={item.id} produtos={products} inicial={item} salvando={upd.isPending}
                onCancel={() => setEditando(null)}
                onSave={async (d) => { await upd.mutateAsync({ id: item.id, data: d }); setEditando(null) }} />
            ) : (
              <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: '#e8e8e8' }}>{item.description}</p>
                  <p className="text-[11px]" style={{ color: '#666' }}>
                    {item.quantity > 1 && `${item.quantity} × `}{formatCurrency(item.unit_price)}
                    {item.quantity > 1 && ` = ${formatCurrency(itemTotal(item))}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <MiniBtn title="Editar item" onClick={() => setEditando(item.id)} hover="#40a0ff">
                    <Pencil size={12} />
                  </MiniBtn>
                  <MiniBtn title="Remover item" onClick={() => del.mutate(item.id)} hover="#ff4444">
                    <Trash2 size={12} />
                  </MiniBtn>
                </div>
              </div>
            )
          ))}

          {novoAberto && (
            <ItemForm produtos={products} salvando={add.isPending}
              onCancel={() => setNovoAberto(false)}
              onSave={async (d) => {
                await add.mutateAsync({
                  product_id: d.product_id ?? null,
                  description: d.description ?? '',
                  unit_price: d.unit_price ?? 0,
                  quantity: d.quantity ?? 1,
                })
                setNovoAberto(false)
              }} />
          )}

          {itens.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
              <span className="text-xs" style={{ color: '#888' }}>
                Soma dos itens <span style={{ color: '#555' }}>(referência)</span>
              </span>
              <span className="text-sm tabular-nums" style={{ color: '#888' }}>
                {formatCurrency(total)}
              </span>
            </div>
          )}

          <p className="text-[11px] leading-relaxed" style={{ color: '#555' }}>
            Quem conta pro faturamento é sempre o valor do contrato, lá em cima — os itens
            servem só pra saber o que foi vendido nele.
          </p>
        </>
      )}
    </div>
  )
}

function ItemForm({ produtos, inicial, salvando, onSave, onCancel }: {
  produtos: { id: string; name: string; default_price: number | null }[]
  inicial?: ContractItem
  salvando: boolean
  onSave:   (d: Partial<ContractItem>) => void
  onCancel: () => void
}) {
  const [productId, setProductId] = useState(inicial?.product_id ?? '')
  const [desc, setDesc]           = useState(inicial?.description ?? '')
  const [preco, setPreco]         = useState(inicial ? String(inicial.unit_price) : '')
  const [qtd, setQtd]             = useState(inicial ? String(inicial.quantity) : '1')

  /** Escolher produto preenche nome e preço — sugestão, não trava. */
  function escolherProduto(id: string) {
    setProductId(id)
    const p = produtos.find((x) => x.id === id)
    if (!p) return
    if (!desc.trim()) setDesc(p.name)
    if (!preco && p.default_price != null) setPreco(String(p.default_price))
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-3 rounded-lg"
      style={{ border: '1px solid var(--tenant-primary)', background: 'rgba(0,230,118,0.04)' }}>
      <Select label="Produto do catálogo" value={productId}
        onChange={(e) => escolherProduto(e.target.value)}
        options={[
          { value: '', label: 'Item avulso (fora do catálogo)' },
          ...produtos.map((p) => ({ value: p.id, label: p.name })),
        ]} />

      <Input label="Descrição *" value={desc} onChange={(e) => setDesc(e.target.value)}
        placeholder="O que foi vendido" />

      <div className="grid grid-cols-2 gap-2">
        <Input label="Valor negociado (R$)" type="number" step="0.01" min="0" value={preco}
          onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
        <Input label="Quantidade" type="number" step="1" min="1" value={qtd}
          onChange={(e) => setQtd(e.target.value)} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button loading={salvando} disabled={!desc.trim()}
          onClick={() => onSave({
            product_id:  productId || null,
            description: desc,
            unit_price:  Number(preco) || 0,
            quantity:    Math.max(1, Number(qtd) || 1),
          })}>
          Salvar item
        </Button>
      </div>
    </div>
  )
}

function MiniBtn({ title, onClick, hover, children }: {
  title: string; onClick: () => void; hover: string; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="h-6 w-6 rounded flex items-center justify-center transition-colors"
      style={{ color: '#555' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = hover }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#555' }}>
      {children}
    </button>
  )
}
