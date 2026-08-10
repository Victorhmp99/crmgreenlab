import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, X, ArrowRight } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import type { KanbanCardData } from '@/services/pipeline'
import type { PipelineStage, Lead } from '@/types'
import type { Pipeline } from '@/services/pipelineManagement'

interface Props {
  open:               boolean
  onClose:            () => void
  currentPipelineId:  string | null
  allCards:           KanbanCardData[]
  allStages:          PipelineStage[]
  pipelines:          Pipeline[]
  onOpenLead:         (lead: Lead) => void
  onGoToPipeline:     (pipelineId: string) => void
}

interface SearchResult {
  lead: Lead
  pipelineId: string
  pipelineName: string
  pipelineColor: string
  stageId: string
  stageName: string
  stageColor: string
  isCurrent: boolean
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function PipelineSearchPopover({
  open, onClose, currentPipelineId, allCards, allStages, pipelines, onOpenLead, onGoToPipeline,
}: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim()
    if (q.length < 2) return []

    const nameQuery = q.toLowerCase()
    const phoneQuery = normalize(q)
    const searchByPhone = phoneQuery.length >= 3 && /\d/.test(q)

    const stageMap = new Map(allStages.map((s) => [s.id, s]))
    const pipelineMap = new Map(pipelines.map((p) => [p.id, p]))

    const matches: SearchResult[] = []
    for (const c of allCards) {
      const lead = c.lead
      const nameMatch = lead.name.toLowerCase().includes(nameQuery)
      const phoneMatch = searchByPhone && lead.phone && normalize(lead.phone).includes(phoneQuery)
      if (!nameMatch && !phoneMatch) continue

      const stage = stageMap.get(c.card.stage_id)
      if (!stage || !stage.pipeline_id) continue
      const pipeline = pipelineMap.get(stage.pipeline_id)
      if (!pipeline) continue

      matches.push({
        lead,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        pipelineColor: pipeline.color,
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        isCurrent: pipeline.id === currentPipelineId,
      })
    }

    matches.sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      return a.lead.name.localeCompare(b.lead.name)
    })

    return matches.slice(0, 30)
  }, [query, allCards, allStages, pipelines, currentPipelineId])

  if (!open) return null

  const currentResults = results.filter((r) => r.isCurrent)
  const otherResults = results.filter((r) => !r.isCurrent)

  return (
    <div ref={wrapperRef}
      className="absolute right-0 top-full mt-2 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl"
      style={{ background: '#141414', border: '1px solid #2a2a2a' }}>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <Search size={14} style={{ color: '#555' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: '#e8e8e8' }}
        />
        <button onClick={onClose}
          className="h-6 w-6 rounded flex items-center justify-center transition-colors"
          style={{ color: '#555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
          <X size={13} />
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {query.trim().length < 2 ? (
          <p className="text-xs text-center py-6" style={{ color: '#555' }}>
            Digite ao menos 2 caracteres
          </p>
        ) : results.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: '#555' }}>
            Nenhum lead encontrado nas pipelines
          </p>
        ) : (
          <>
            {currentResults.length > 0 && (
              <div className="py-1">
                <p className="text-[10px] font-medium uppercase tracking-wider px-3 py-1.5" style={{ color: '#555' }}>
                  Nesta pipeline · {currentResults.length}
                </p>
                {currentResults.map((r) => (
                  <ResultRow key={r.lead.id} result={r} onClick={() => { onOpenLead(r.lead); onClose() }} showPipeline={false} />
                ))}
              </div>
            )}
            {otherResults.length > 0 && (
              <div className="py-1" style={{ borderTop: currentResults.length > 0 ? '1px solid #1e1e1e' : undefined }}>
                <p className="text-[10px] font-medium uppercase tracking-wider px-3 py-1.5" style={{ color: '#555' }}>
                  Em outras pipelines · {otherResults.length}
                </p>
                {otherResults.map((r) => (
                  <ResultRow key={r.lead.id} result={r} onClick={() => { onGoToPipeline(r.pipelineId); onClose() }} showPipeline />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ResultRow({ result, onClick, showPipeline }: { result: SearchResult; onClick: () => void; showPipeline: boolean }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2 text-left transition-colors"
      onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#e8e8e8' }}>{result.lead.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {showPipeline && (
            <>
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: result.pipelineColor }} />
              <span className="text-[11px]" style={{ color: '#888' }}>{result.pipelineName}</span>
              <ArrowRight size={9} style={{ color: '#444' }} />
            </>
          )}
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: result.stageColor }} />
          <span className="text-[11px]" style={{ color: '#aaa' }}>{result.stageName}</span>
          {result.lead.phone && (
            <span className="text-[10px] ml-auto tabular-nums" style={{ color: '#555' }}>
              {formatPhone(result.lead.phone)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
