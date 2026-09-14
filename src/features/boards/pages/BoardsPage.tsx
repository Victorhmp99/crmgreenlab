import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, SquareKanban, AlertTriangle, UserRound, Layers } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'
import { createBoard, CORES_QUADRO } from '@/services/boards'
import { useBoards, useRecarregaQuadro } from '../hooks/useBoards'
import { Swatches } from '../components/comum'

/**
 * Lista de quadros da empresa. Cada quadro é um "Trello": Marketing,
 * Comercial, o que a equipe quiser. O primeiro é criado daqui mesmo.
 */
export function BoardsPage() {
  const navigate  = useNavigate()
  const tenantId  = useAuthStore((s) => s.tenant?.id)
  const [params]  = useSearchParams()
  const { data: boards = [], isLoading, error } = useBoards()
  const recarregar = useRecarregaQuadro(null)

  const [criando, setCriando] = useState(false)
  const [nome,    setNome]    = useState('')
  const [cor,     setCor]     = useState<string | null>(CORES_QUADRO[4])
  const [salvando, setSalvando] = useState(false)
  const [erro,    setErro]    = useState<string | null>(null)

  // Veio do aviso "tarefas atrasadas" — destaca os quadros com atraso.
  const destacarPrazo = params.get('prazo') === '1'

  async function criar() {
    const n = nome.trim()
    if (!n || !tenantId) return
    setSalvando(true); setErro(null)
    try {
      const id = await createBoard(tenantId, n, cor)
      recarregar()
      setCriando(false); setNome('')
      navigate(`/boards/${id}`)
    } catch (e) { setErro((e as Error).message) }
    finally { setSalvando(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Tarefas</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            Quadros da empresa — organize o trabalho em colunas e arraste
          </p>
        </div>
        <Button onClick={() => setCriando(true)}><Plus size={15} /> Novo quadro</Button>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner size="md" /></div>}
      {error && <p className="text-sm" style={{ color: '#ff4444' }}>{(error as Error).message}</p>}

      {!isLoading && boards.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center gap-3" style={{ background: '#111', border: '1px dashed #2a2a2a' }}>
          <SquareKanban size={36} style={{ color: '#333' }} />
          <p className="text-sm font-medium" style={{ color: '#ccc' }}>Nenhum quadro ainda</p>
          <p className="text-xs max-w-sm" style={{ color: '#666' }}>
            Um quadro nasce com as colunas <b>A fazer · Fazendo · Feito</b>. Você renomeia, cria colunas e etiquetas do seu jeito.
          </p>
          <Button onClick={() => setCriando(true)}><Plus size={15} /> Criar o primeiro quadro</Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {boards.map((b) => {
          const alerta = destacarPrazo && b.atrasados > 0
          return (
            <button key={b.id} onClick={() => navigate(`/boards/${b.id}`)}
              className="group rounded-xl text-left overflow-hidden transition-transform hover:-translate-y-0.5"
              style={{ background: '#111', border: `1px solid ${alerta ? 'rgba(255,68,68,0.5)' : '#1e1e1e'}` }}>
              <div className="h-2" style={{ background: b.color ?? '#2a2a2a' }} />
              <div className="p-4 flex flex-col gap-3">
                <h3 className="text-base font-semibold truncate" style={{ color: '#e8e8e8' }}>{b.name}</h3>
                <div className="flex items-center gap-3 text-xs" style={{ color: '#666' }}>
                  <span className="inline-flex items-center gap-1" title="Cartões abertos"><Layers size={12} /> {b.abertos}</span>
                  {b.meus > 0 && <span className="inline-flex items-center gap-1" style={{ color: '#40a0ff' }} title="Meus"><UserRound size={12} /> {b.meus}</span>}
                  {b.atrasados > 0 && <span className="inline-flex items-center gap-1" style={{ color: '#ff4444' }} title="Atrasados"><AlertTriangle size={12} /> {b.atrasados}</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <Modal open={criando} onClose={() => setCriando(false)} title="Novo quadro" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setCriando(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando} disabled={!nome.trim()}>Criar quadro</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <Input label="Nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') criar() }} placeholder="Marketing, Comercial, Operacional…" />
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: '#888' }}>Cor</p>
            <Swatches value={cor} onChange={setCor} size={26} />
          </div>
          <p className="text-xs" style={{ color: '#555' }}>Nasce com A fazer · Fazendo · Feito. Tudo editável depois.</p>
          {erro && <p className="text-xs" style={{ color: '#ff4444' }}>{erro}</p>}
        </div>
      </Modal>
    </div>
  )
}
