import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Trash2, Loader2, MapPin, Camera, FileText, Map, Calendar, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { RecoveryService, RecoveryItem } from '@services/RecoveryService'
import { EmptyState } from '@components/shared/EmptyState'
import { Button } from '@components/shared/Button'
import { formatDate, cx } from '@lib/format'

const TYPE_META: Record<RecoveryItem['type'], { icon: any; label: string; tone: string }> = {
  place:  { icon: MapPin,   label: 'Place',  tone: 'text-accent' },
  trip:   { icon: Map,      label: 'Trip',   tone: 'text-success' },
  visit:  { icon: Calendar, label: 'Visit',  tone: 'text-inkSoft' },
  note:   { icon: FileText, label: 'Note',   tone: 'text-inkSoft' },
  media:  { icon: Camera,   label: 'Photo',  tone: 'text-inkSoft' },
  album:  { icon: ImageIcon,label: 'Album',  tone: 'text-inkSoft' },
}

export default function RecentlyDeleted() {
  const { user } = useAuth()
  const [items, setItems] = useState<RecoveryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      setItems(await RecoveryService.listAll(user.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() /* eslint-disable-next-line */ }, [user?.id])

  const restore = async (it: RecoveryItem) => {
    setBusyId(it.id)
    try {
      await RecoveryService.restore(it.type, it.id)
      setItems(items.filter((x) => x.id !== it.id))
    } finally {
      setBusyId(null)
    }
  }

  const purge = async (it: RecoveryItem) => {
    if (!confirm(`Permanently delete this ${it.type}? This cannot be undone.`)) return
    setBusyId(it.id)
    try {
      await RecoveryService.deletePermanently(it.type, it.id)
      setItems(items.filter((x) => x.id !== it.id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-semibold">Recently deleted</h1>
          <div className="text-xs text-inkSoft">Items are kept for 30 days, then removed permanently</div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-inkSoft py-12 justify-center">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Trash2 size={18} />}
            title="Nothing here"
            subtitle="When you delete a place, trip, photo, or note, it lands here so you can restore it within 30 days."
          />
        ) : (
          <div className="bg-panel border border-paperEdge rounded-xl divide-y divide-paperEdge">
            {items.map((it) => {
              const meta = TYPE_META[it.type]
              const Icon = meta.icon
              return (
                <div key={`${it.type}-${it.id}`} className="px-4 py-3 flex items-center gap-3">
                  <div className={cx('w-8 h-8 rounded-lg bg-paperDeep flex items-center justify-center', meta.tone)}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.label}</div>
                    <div className="text-xs text-inkSoft">
                      {meta.label} · deleted {formatDate(it.deletedAt)} ·{' '}
                      <span className={it.daysLeft <= 7 ? 'text-danger' : ''}>
                        {it.daysLeft} day{it.daysLeft === 1 ? '' : 's'} left
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" disabled={busyId === it.id} onClick={() => restore(it)}>
                      <RotateCcw size={12} /> Restore
                    </Button>
                    <button
                      onClick={() => purge(it)}
                      disabled={busyId === it.id}
                      className="p-1.5 text-inkFaint hover:text-danger"
                      title="Delete permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
