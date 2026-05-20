import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Plus, Building2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore, type TenantOption } from '@/store/authStore'
import { getInitials } from '@/lib/utils'

interface TenantSwitcherProps {
  collapsed: boolean
  onCreateTenant: () => void
}

export function TenantSwitcher({ collapsed, onCreateTenant }: TenantSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const queryClient     = useQueryClient()

  const tenant           = useAuthStore((s) => s.tenant)
  const membership       = useAuthStore((s) => s.membership)
  const availableTenants = useAuthStore((s) => s.availableTenants)
  const switchTenant     = useAuthStore((s) => s.switchTenant)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Não mostra switcher se só tem 1 empresa E não pode criar
  const canCreate = membership?.role === 'admin' || membership?.role === 'manager'
  if (availableTenants.length <= 1 && !canCreate) return null

  function handleSwitch(option: TenantOption) {
    if (option.tenant.id === tenant?.id) { setOpen(false); return }

    // Muda empresa no store
    switchTenant(option)

    // Invalida TODO o cache React Query — dados da nova empresa serão buscados do zero
    queryClient.clear()

    setOpen(false)
  }

  if (collapsed) {
    // Versão compacta: só mostra o ícone com tooltip nativo
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          title={tenant?.name ?? 'Trocar empresa'}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          style={{
            background: open ? 'rgba(0,230,118,0.1)' : 'transparent',
            border: '1px solid ' + (open ? 'var(--tenant-primary)' : '#2a2a2a'),
          }}
        >
          <Building2 size={15} style={{ color: open ? 'var(--tenant-primary)' : '#666' }} />
        </button>

        {open && (
          <TenantDropdown
            availableTenants={availableTenants}
            currentTenantId={tenant?.id ?? ''}
            onSwitch={handleSwitch}
            onCreateTenant={() => { setOpen(false); onCreateTenant() }}
            canCreate={canCreate}
            side="right"
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 transition-colors text-left"
        style={{
          background: open ? 'rgba(0,230,118,0.06)' : 'transparent',
          border: '1px solid ' + (open ? 'var(--tenant-primary)' : '#2a2a2a'),
        }}
      >
        {/* Avatar da empresa */}
        <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold"
          style={{ background: 'var(--tenant-primary)', color: '#000' }}>
          {getInitials(tenant?.name ?? 'E')}
        </div>

        {/* Nome da empresa */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: '#e8e8e8' }}>
            {tenant?.name ?? 'Sem empresa'}
          </p>
          {availableTenants.length > 1 && (
            <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {availableTenants.length} empresas
            </p>
          )}
        </div>

        <ChevronDown size={13} className="shrink-0 transition-transform"
          style={{
            color: '#555',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
      </button>

      {open && (
        <TenantDropdown
          availableTenants={availableTenants}
          currentTenantId={tenant?.id ?? ''}
          onSwitch={handleSwitch}
          onCreateTenant={() => { setOpen(false); onCreateTenant() }}
          canCreate={canCreate}
          side="bottom"
        />
      )}
    </div>
  )
}

// ── Dropdown compartilhado ──────────────────────────────────────────────────────

interface DropdownProps {
  availableTenants: TenantOption[]
  currentTenantId:  string
  onSwitch:         (option: TenantOption) => void
  onCreateTenant:   () => void
  canCreate:        boolean
  side:             'bottom' | 'right'
}

function TenantDropdown({
  availableTenants, currentTenantId,
  onSwitch, onCreateTenant, canCreate, side,
}: DropdownProps) {
  const posStyle = side === 'right'
    ? { left: '100%', top: 0, marginLeft: '8px' }
    : { top: '100%', left: 0, right: 0, marginTop: '4px' }

  return (
    <div
      className="absolute z-50 rounded-xl overflow-hidden shadow-2xl py-1"
      style={{
        ...posStyle,
        background: '#141414',
        border: '1px solid #2a2a2a',
        minWidth: side === 'right' ? '200px' : undefined,
      }}
    >
      {/* Label */}
      <div className="px-3 py-1.5">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: '#444' }}>
          Suas empresas
        </p>
      </div>

      {/* Lista de empresas */}
      {availableTenants.map((option) => {
        const isActive = option.tenant.id === currentTenantId
        return (
          <button
            key={option.tenant.id}
            onClick={() => onSwitch(option)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
            style={{
              background: isActive ? 'rgba(0,230,118,0.06)' : 'transparent',
              color: isActive ? 'var(--tenant-primary)' : '#aaa',
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e' }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 text-[10px] font-bold"
              style={{
                background: isActive ? 'rgba(0,230,118,0.2)' : '#2a2a2a',
                color: isActive ? 'var(--tenant-primary)' : '#888',
              }}>
              {getInitials(option.tenant.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{option.tenant.name}</p>
              <p className="text-[10px] capitalize" style={{ color: '#555' }}>{option.membership.role}</p>
            </div>
            {isActive && <Check size={12} style={{ color: 'var(--tenant-primary)', flexShrink: 0 }} />}
          </button>
        )
      })}

      {/* Criar nova empresa */}
      {canCreate && (
        <>
          <div className="mx-3 my-1 h-px" style={{ background: '#2a2a2a' }} />
          <button
            onClick={onCreateTenant}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
            style={{ color: '#666' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8e8'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#666'
            }}
          >
            <div className="h-6 w-6 rounded flex items-center justify-center shrink-0"
              style={{ background: '#1e1e1e', border: '1px dashed #3a3a3a' }}>
              <Plus size={11} style={{ color: '#666' }} />
            </div>
            <p className="text-xs">Criar nova empresa</p>
          </button>
        </>
      )}
    </div>
  )
}
