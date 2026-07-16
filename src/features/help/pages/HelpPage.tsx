import { Link } from 'react-router-dom'
import { HelpCircle, ChevronRight, Star } from 'lucide-react'
import { HELP_CATEGORIES } from '../data'

export function HelpPage() {
  const featured = HELP_CATEGORIES.filter((c) => c.featured)
  const others   = HELP_CATEGORIES.filter((c) => !c.featured)

  return (
    <div className="flex flex-col gap-8 max-w-4xl" style={{ isolation: 'isolate' }}>
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
          Central de Ajuda
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
          Escolha um tema abaixo para ver a resposta completa.
        </p>
      </div>

      {featured.length > 0 && (
        <div className="flex flex-col gap-3 relative">
          <div className="flex items-center gap-1.5">
            <Star size={12} style={{ color: '#fbbf24' }} fill="#fbbf24" />
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
              Mais buscadas
            </span>
          </div>
          <div className="flex flex-wrap gap-4 items-start">
            {featured.map((cat) => <CategoryCard key={cat.slug} category={cat} large />)}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="flex flex-col gap-3 relative">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
            Outros temas
          </span>
          <div className="flex flex-wrap gap-4 items-start">
            {others.map((cat) => <CategoryCard key={cat.slug} category={cat} />)}
          </div>
        </div>
      )}

      {/* Última opção — só aparece depois de todas as categorias */}
      <a
        href="/docs.html"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center gap-3 rounded-xl px-4 py-3.5 mt-2 transition-colors"
        style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-dim)' }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--tenant-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
      >
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--bg-surface2)' }}>
          <HelpCircle size={15} style={{ color: 'var(--text-dim)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Não encontrei o que eu queria
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            Acessar a documentação completa do sistema
          </p>
        </div>
        <ChevronRight size={16} className="opacity-40 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-dim)' }} />
      </a>
    </div>
  )
}

function CategoryCard({ category, large = false }: { category: typeof HELP_CATEGORIES[number]; large?: boolean }) {
  return (
    <section className="relative rounded-xl p-5 flex flex-col gap-3"
      style={{
        background: 'var(--bg-surface)',
        border: large ? '1px solid rgba(0,230,118,0.25)' : '1px solid var(--border-dim)',
        flex: `1 1 ${large ? '360px' : '300px'}`,
        minWidth: large ? '340px' : '280px',
        maxWidth: '100%',
      }}>
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '1px solid var(--border-dim)' }}>
        <category.icon size={15} style={{ color: 'var(--tenant-primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {category.title}
        </h2>
      </div>

      <div className="flex flex-col gap-0.5">
        {category.questions.map((q) => (
          <Link
            key={q.slug}
            to={`/ajuda/${q.slug}`}
            className="group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span className="text-sm flex-1 min-w-0" style={{ color: 'var(--text)' }}>
              {q.question}
            </span>
            <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
              style={{ color: 'var(--text-dim)' }} />
          </Link>
        ))}
      </div>
    </section>
  )
}
