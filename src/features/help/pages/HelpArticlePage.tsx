import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { findQuestion } from '../data'

export function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const found = findQuestion(slug)

  if (!found) return <Navigate to="/ajuda" replace />

  const { category, question } = found

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <Link to="/ajuda"
        className="inline-flex items-center gap-1.5 text-xs font-medium w-fit transition-colors"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <ArrowLeft size={13} /> Central de Ajuda
      </Link>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5"
          style={{ color: 'var(--tenant-primary)' }}>
          <category.icon size={12} />
          {category.title}
        </span>
        <h1 className="text-lg font-semibold mt-1.5" style={{ color: 'var(--text)' }}>
          {question.question}
        </h1>
      </div>

      <div className="rounded-xl p-5 flex flex-col gap-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
        {question.answer}
      </div>
    </div>
  )
}
