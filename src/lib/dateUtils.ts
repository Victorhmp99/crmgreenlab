// Formata datas de forma relativa em português sem dependência externa
export function formatDistanceToNow(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(diff / 3_600_000)
  const d    = Math.floor(diff / 86_400_000)

  if (min < 1)  return 'agora'
  if (min < 60) return `há ${min}min`
  if (h   < 24) return `há ${h}h`
  if (d   < 2)  return 'ontem'
  if (d   < 7)  return `há ${d} dias`

  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
