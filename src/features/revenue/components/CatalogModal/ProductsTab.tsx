import { useState, type FormEvent, type ReactNode } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useFinancialCategories } from '../../hooks/useFinancialCategories'
import { useFinancialProducts, useFinancialProductMutations } from '../../hooks/useFinancialProducts'
import {
  calcMargin,
  type FinancialProduct,
  type CreateFinancialProductData,
  type ProductBillingType,
} from '@/services/financialProducts'
import { formatCurrency } from '@/lib/utils'

/**
 * Catálogo de produtos/serviços.
 *
 * Cada produto declara COMO é cobrado (recorrente/MRR ou pagamento único/TCV)
 * e a qual categoria pertence. Os dois campos existem porque alimentam
 * decisões diferentes: o tipo de cobrança muda como o valor entra na conta de
 * receita; a categoria é o que faz os gráficos pararem de mostrar tudo junto
 * como "Sem categoria".
 */

const BILLING_OPTIONS = [
  { value: 'one_time',  label: 'Pagamento único (TCV)' },
  { value: 'recurring', label: 'Recorrente (MRR)' },
]

export function ProductsTab() {
  const { data: products = [], isLoading } = useFinancialProducts()
  const { data: categories = [] } = useFinancialCategories()
  const { create, update, deactivate } = useFinancialProductMutations()

  const [name, setName]             = useState('')
  const [price, setPrice]           = useState('')
  const [cost, setCost]             = useState('')
  const [billing, setBilling]       = useState<ProductBillingType>('one_time')
  const [categoryId, setCategoryId] = useState('')
  /** id do produto em edição — null quando ninguém está sendo editado */
  const [editando, setEditando]     = useState<string | null>(null)

  // Produto gera receita, então categoria de despesa não faz sentido aqui.
  const catsReceita = categories.filter((c) => c.type === 'revenue' || c.type === 'both')
  const catOptions = [
    { value: '', label: 'Sem categoria' },
    ...catsReceita.map((c) => ({ value: c.id, label: c.name })),
  ]

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await create.mutateAsync({
      name,
      default_price: price ? Number(price) : null,
      cost_price:    cost  ? Number(cost)  : null,
      billing_type:  billing,
      category_id:   categoryId || null,
    })
    setName(''); setPrice(''); setCost(''); setBilling('one_time'); setCategoryId('')
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-40">
          <Input label="Produto/Serviço" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Gestão Tráfego Meta Ads" />
        </div>
        <div className="w-44">
          <Select label="Cobrança" value={billing}
            onChange={(e) => setBilling(e.target.value as ProductBillingType)}
            options={BILLING_OPTIONS} />
        </div>
        <div className="w-40">
          <Select label="Categoria" value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)} options={catOptions} />
        </div>
        <div className="w-28">
          <Input label="Preço (R$)" type="number" step="0.01" min="0" value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
        </div>
        <div className="w-28">
          <Input label="Custo (R$)" type="number" step="0.01" min="0" value={cost}
            onChange={(e) => setCost(e.target.value)} placeholder="0,00" />
        </div>
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          <Plus size={14} /> Adicionar
        </Button>
      </form>

      {catsReceita.length === 0 && (
        <p className="text-[11px] leading-relaxed" style={{ color: '#666' }}>
          Nenhuma categoria de receita ainda — crie uma na aba <strong>Categorias</strong> para
          classificar os produtos. É isso que faz os gráficos deixarem de mostrar tudo
          como “Sem categoria”.
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : products.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: '#444' }}>
          Nenhum produto/serviço cadastrado ainda. Adicione o primeiro acima.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {products.map((p) => (
            editando === p.id ? (
              <ProductEditRow
                key={p.id} product={p} catOptions={catOptions} salvando={update.isPending}
                onCancel={() => setEditando(null)}
                onSave={async (dados) => {
                  await update.mutateAsync({ id: p.id, data: dados })
                  setEditando(null)
                }} />
            ) : (
              <ProductRow
                key={p.id} product={p} categories={categories}
                onEdit={() => setEditando(p.id)}
                onRemove={() => deactivate.mutate(p.id)} />
            )
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({ product: p, categories, onEdit, onRemove }: {
  product:    FinancialProduct
  categories: { id: string; name: string }[]
  onEdit:     () => void
  onRemove:   () => void
}) {
  const margin = calcMargin(p.default_price, p.cost_price)
  const cat = categories.find((c) => c.id === p.category_id)
  const recorrente = p.billing_type === 'recurring'

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg"
      style={{ border: '1px solid #1e1e1e' }}>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm" style={{ color: '#e8e8e8' }}>{p.name}</span>
          {/* MRR e TCV entram de formas diferentes na conta de receita —
              precisa dar pra distinguir de relance. */}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={recorrente
              ? { background: 'rgba(0,230,118,0.12)', color: '#00e676' }
              : { background: 'rgba(64,160,255,0.12)', color: '#40a0ff' }}>
            {recorrente ? 'MRR' : 'TCV'}
          </span>
          {cat && (
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: '#1e1e1e', color: '#888' }}>{cat.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: '#666' }}>
          {p.default_price != null && <span>Venda: {formatCurrency(p.default_price)}</span>}
          {p.cost_price != null && <span>Custo: {formatCurrency(p.cost_price)}</span>}
          {margin != null && (
            <span style={{ color: margin >= 0 ? '#00e676' : '#ff4444' }}>Margem: {margin}%</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <IconBtn title="Editar produto" onClick={onEdit} hover="#40a0ff"><Pencil size={13} /></IconBtn>
        <IconBtn title="Remover produto" onClick={onRemove} hover="#ff4444"><Trash2 size={13} /></IconBtn>
      </div>
    </div>
  )
}

function ProductEditRow({ product: p, catOptions, salvando, onSave, onCancel }: {
  product:    FinancialProduct
  catOptions: { value: string; label: string }[]
  salvando:   boolean
  onSave:     (d: Partial<CreateFinancialProductData>) => void
  onCancel:   () => void
}) {
  const [name, setName]             = useState(p.name)
  const [price, setPrice]           = useState(p.default_price?.toString() ?? '')
  const [cost, setCost]             = useState(p.cost_price?.toString() ?? '')
  const [billing, setBilling]       = useState<ProductBillingType>(p.billing_type)
  const [categoryId, setCategoryId] = useState(p.category_id ?? '')

  return (
    <div className="flex gap-2 items-end flex-wrap px-3 py-3 rounded-lg"
      style={{ border: '1px solid var(--tenant-primary)', background: 'rgba(0,230,118,0.04)' }}>
      <div className="flex-1 min-w-36">
        <Input label="Produto/Serviço" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="w-40">
        <Select label="Cobrança" value={billing}
          onChange={(e) => setBilling(e.target.value as ProductBillingType)}
          options={BILLING_OPTIONS} />
      </div>
      <div className="w-36">
        <Select label="Categoria" value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)} options={catOptions} />
      </div>
      <div className="w-24">
        <Input label="Preço" type="number" step="0.01" min="0" value={price}
          onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="w-24">
        <Input label="Custo" type="number" step="0.01" min="0" value={cost}
          onChange={(e) => setCost(e.target.value)} />
      </div>
      <Button loading={salvando} disabled={!name.trim()}
        onClick={() => onSave({
          name,
          default_price: price ? Number(price) : null,
          cost_price:    cost  ? Number(cost)  : null,
          billing_type:  billing,
          category_id:   categoryId || null,
        })}>
        Salvar
      </Button>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
    </div>
  )
}

function IconBtn({ title, onClick, hover, children }: {
  title: string; onClick: () => void; hover: string; children: ReactNode
}) {
  return (
    <button onClick={onClick} title={title}
      className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
      style={{ color: '#555' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = hover; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}
