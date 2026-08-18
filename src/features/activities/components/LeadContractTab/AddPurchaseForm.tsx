import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { useFinancialMutations } from '@/features/revenue/hooks/useFinancialMutations'
import { useFinancialProducts, useFinancialProductMutations } from '@/features/revenue/hooks/useFinancialProducts'
import { recalculateLeadValue } from '@/services/clientContracts'

interface Props {
  leadId: string
}

const NEW_PRODUCT_VALUE = '__new__'

export function AddPurchaseForm({ leadId }: Props) {
  const { create } = useFinancialMutations()
  const { data: products = [] } = useFinancialProducts()
  const { create: createProduct } = useFinancialProductMutations()
  const queryClient = useQueryClient()

  const [productId, setProductId] = useState('')
  const [amount, setAmount]       = useState('')
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10))

  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')
  const [newProductCost, setNewProductCost] = useState('')

  const productOptions = [
    ...products.map((p) => ({ value: p.id, label: p.name })),
    { value: NEW_PRODUCT_VALUE, label: '+ Novo produto/serviço...' },
  ]

  function handleProductChange(id: string) {
    if (id === NEW_PRODUCT_VALUE) {
      setShowNewProduct(true)
      setProductId('')
      return
    }
    setProductId(id)
    const product = products.find((p) => p.id === id)
    if (product?.default_price != null && !amount) setAmount(String(product.default_price))
  }

  async function handleCreateProduct() {
    if (!newProductName.trim()) return
    const created = await createProduct.mutateAsync({
      name:          newProductName,
      default_price: newProductPrice ? Number(newProductPrice) : null,
      cost_price:    newProductCost ? Number(newProductCost) : null,
    })
    setProductId(created.id)
    if (created.default_price != null && !amount) setAmount(String(created.default_price))
    setShowNewProduct(false)
    setNewProductName(''); setNewProductPrice(''); setNewProductCost('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!amount) return
    const product = products.find((p) => p.id === productId)
    await create.mutateAsync({
      type:        'revenue',
      lead_id:     leadId,
      product_id:  productId || undefined,
      amount:      Number(amount),
      date,
      description: product ? `Adicional: ${product.name}` : 'Adicional',
    })
    await recalculateLeadValue(leadId)
    queryClient.invalidateQueries({ queryKey: ['lead-purchases', leadId] })
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
    setProductId(''); setAmount(''); setDate(new Date().toISOString().slice(0, 10))
  }

  if (showNewProduct) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: '#888' }}>Novo produto/serviço</span>
          <button onClick={() => setShowNewProduct(false)}
            className="h-6 w-6 rounded flex items-center justify-center" style={{ color: '#555' }}>
            <X size={12} />
          </button>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-32">
            <Input label="Nome *" value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)} placeholder="Ex: Setup CRM" />
          </div>
          <div className="w-28">
            <Input label="Preço (R$)" type="number" step="0.01" min="0"
              value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} placeholder="0,00" />
          </div>
          <div className="w-28">
            <Input label="Custo (R$)" type="number" step="0.01" min="0"
              value={newProductCost} onChange={(e) => setNewProductCost(e.target.value)} placeholder="0,00" />
          </div>
          <button onClick={handleCreateProduct} disabled={!newProductName.trim() || createProduct.isPending}
            className="h-10 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{ background: 'var(--tenant-primary)', color: '#000' }}>
            <Plus size={13} /> Criar
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-32">
        <Select label="Produto (opcional)" value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
          options={productOptions} placeholder="Selecionar..." />
      </div>
      <div className="w-28">
        <Input label="Valor (R$) *" type="number" step="0.01" min="0"
          value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
      </div>
      <DatePicker label="Data" clearable={false} className="w-36"
        value={date} onChange={(v) => v && setDate(v)} />
      <button type="submit" disabled={!amount || create.isPending}
        className="h-10 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40"
        style={{ background: 'var(--tenant-primary)', color: '#000' }}>
        <Plus size={13} /> Adicionar
      </button>
    </form>
  )
}
