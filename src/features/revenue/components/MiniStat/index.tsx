interface Props {
  icon?:  React.ElementType
  color:  string
  label:  string
  value:  string
}

export function MiniStat({ icon: Icon, color, label, value }: Props) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: '#1a1a1a' }}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={12} style={{ color }} />}
        <span className="text-[10px] uppercase tracking-wide" style={{ color: '#666' }}>{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{value}</p>
    </div>
  )
}
