/** Format YYYY-MM-DD as "12 Jan 2025" */
export function formatDate(iso: string | undefined | null, opts: { withYear?: boolean; long?: boolean } = {}): string {
  if (!iso) return ''
  const datePart = iso.split('T')[0]
  if (!datePart) return iso
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = opts.long
    ? ['January','February','March','April','May','June','July','August','September','October','November','December']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return opts.withYear === false ? `${d} ${months[m - 1]}` : `${d} ${months[m - 1]} ${y}`
}

/** Format range like "12–18 Jan 2025" or "28 Dec 2024 – 4 Jan 2025" */
export function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return ''
  if (!end || start === end) return formatDate(start)
  const startDate = (start ?? '').split('T')[0] ?? ''
  const endDate = (end ?? '').split('T')[0] ?? ''
  const [sy, sm, sd] = startDate.split('-')
  const [ey, em, ed] = endDate.split('-')
  if (sy === ey && sm === em && sm) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${Number(sd)}–${Number(ed)} ${months[Number(sm) - 1]} ${sy}`
  }
  if (sy === ey) {
    return `${formatDate(start, { withYear: false })} – ${formatDate(end)}`
  }
  return `${formatDate(start)} – ${formatDate(end)}`
}

/** Time-ago: "5s ago", "2m ago", "3h ago", "yesterday", "12 Mar" */
export function timeAgo(iso: string | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = (Date.now() - t) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 172800) return 'yesterday'
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return formatDate(iso)
}

/** Today's date in YYYY-MM-DD local time */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Days between two ISO dates inclusive */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

/** Add days to YYYY-MM-DD */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0] ?? iso
}

/** Format bytes as "1.2 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Simple class joiner */
export function cx(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
