import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { ProductsTab } from './ProductsTab'
import { useFinancialCategories, useFinancialCategoryMutations } from '../../hooks/useFinancialCategories'
import type { FinancialCategoryType } from '@/services/financialCategories'

interface Props {
  open:    boolean
  onClose: () => void
}

type Tab = 'categories' | 'products'

const TYPE_OPTIONS: { value: FinancialCategoryType; label: string }[] = [
  { value: 'revenue', label: 'Receita' },
  { value: 'expense', label: 'Despesa' },
  { value: 'both',    label: 'Ambos' },
]

export function CatalogModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('categories')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catálogo Financeiro"
      description="Categorias e produtos/serviços da sua empresa"
      size="lg"
    >
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: '#1a1a1a', width: 'fit-content' }}>
        <TabButton active={tab === 'categories'} onClick={() => setTab('categories')}>Categorias</TabButton>
        <TabButton active={tab === 'products'} onClick={() => setTab('products')}>Produtos/Serviços</TabButton>
      </div>
      {tab === 'categories' ? <CategoriesTab /> : <ProductsTab />}
    </Modal>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
      style={{ background: active ? 'var(--tenant-primary)' : 'transparent', color: active ? '#000' : '#888' }}
    >
      {children}
    </button>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-center py-6" style={{ color: '#555' }}>{text}</p>
}

// ── Categorias ──────────────────────────────────────────────────────────────

function CategoriesTab() {
  const { data: categories = [], isLoading } = useFinancialCategories()
  const { create, deactivate } = useFinancialCategoryMutations()
  const [name, setName] = useState('')
  const [type, setType] = useState<FinancialCategoryType>('revenue')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await create.mutateAsync({ name, type })
    setName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex gap-2 items-end">
        <div className="flex-1">
          <Input label="Nova categoria" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Gestão de Tráfego" />
        </div>
        <div className="w-32">
          <Select label="Tipo" value={type}
            onChange={(e) => setType(e.target.value as FinancialCategoryType)} options={TYPE_OPTIONS} />
        </div>
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          <Plus size={14} /> Adicionar
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : categories.length === 0 ? (
        <EmptyHint text="Nenhuma categoria cadastrada ainda. Adicione a primeira acima." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ border: '1px solid #1e1e1e' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#e8e8e8' }}>{c.name}</span>
                <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: '#1e1e1e', color: '#888' }}>
                  {TYPE_OPTIONS.find((t) => t.value === c.type)?.label}
                </span>
              </div>
              <button onClick={() => deactivate.mutate(c.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
                title="Remover categoria">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

