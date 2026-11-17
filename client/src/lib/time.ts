const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })

/** "just now", "5 min. ago", "2 hr. ago", "yesterday"... */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (Number.isNaN(seconds)) return ''
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86_400) return rtf.format(Math.round(seconds / 86_400), 'day')
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' })
}
