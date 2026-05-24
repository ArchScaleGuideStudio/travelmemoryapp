import { Check, Loader2, CloudOff, Cloud } from 'lucide-react'
import type { AutoSaveStatus } from '@hooks/useAutoSave'
import { cx, timeAgo } from '@lib/format'

interface Props {
  status: AutoSaveStatus
  lastSavedAt: number | null
  className?: string
}

export function SaveStatus({ status, lastSavedAt, className }: Props) {
  const map = {
    idle:   { icon: <Cloud size={11} />,           text: lastSavedAt ? `Saved ${timeAgo(new Date(lastSavedAt).toISOString())}` : 'Up to date', tone: 'text-inkFaint' },
    dirty:  { icon: <Cloud size={11} />,           text: 'Editing…',  tone: 'text-inkSoft' },
    saving: { icon: <Loader2 size={11} className="animate-spin" />, text: 'Saving…',   tone: 'text-inkSoft' },
    saved:  { icon: <Check size={11} />,           text: 'Saved',     tone: 'text-success' },
    error:  { icon: <CloudOff size={11} />,        text: 'Save failed — retrying', tone: 'text-danger' },
  } as const
  const { icon, text, tone } = map[status]
  return (
    <div className={cx('inline-flex items-center gap-1.5 text-[11px] font-medium', tone, className)}>
      {icon}<span>{text}</span>
    </div>
  )
}
