import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Image as ImageIcon, Loader2, FolderHeart } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { AlbumsService } from '@services/AlbumsService'
import { MediaService } from '@services/MediaService'
import { EmptyState } from '@components/shared/EmptyState'
import { Button } from '@components/shared/Button'
import { formatDate } from '@lib/format'
import type { Album, Media } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string }

export default function Albums() {
  const { user } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([])
  const [covers, setCovers] = useState<Record<string, MediaWithUrls | undefined>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const list = await AlbumsService.list(user.id)
      setAlbums(list)
      const c: Record<string, MediaWithUrls | undefined> = {}
      await Promise.all(list.map(async (a) => {
        if (!a.coverMediaId) return
        try { c[a.id] = await MediaService.get(a.coverMediaId) ?? undefined } catch {}
      }))
      setCovers(c)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() /* eslint-disable-next-line */ }, [user?.id])

  const handleCreate = async () => {
    if (!user || !newName.trim()) return
    await AlbumsService.create({ userId: user.id, name: newName.trim() })
    setNewName(''); setCreating(false)
    await load()
  }

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold">Albums</h1>
          <div className="text-xs text-inkSoft">Curated photo collections across your trips</div>
        </div>
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setCreating(true)}>New album</Button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {creating && (
          <div className="bg-panel border border-paperEdge rounded-xl p-4 mb-6 flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              placeholder="Album name — e.g. ‘Sunsets’, ‘Food in Vietnam’"
              className="flex-1 bg-paper border border-paperEdge rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <Button size="md" onClick={handleCreate}>Create</Button>
            <Button size="md" variant="secondary" onClick={() => { setCreating(false); setNewName('') }}>Cancel</Button>
          </div>
        )}

        {loading ? (
          <Center><Loader2 size={16} className="animate-spin" /> Loading…</Center>
        ) : albums.length === 0 ? (
          <EmptyState
            icon={<FolderHeart size={18} />}
            title="No albums yet"
            subtitle="Create albums to curate photos by theme — sunsets, food, family, anything you like."
            action={<Button onClick={() => setCreating(true)} icon={<Plus size={14} />}>New album</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {albums.map((a) => (
              <Link key={a.id} to={`/albums/${a.id}`} className="group block">
                <div className="aspect-square bg-paperDeep rounded-xl overflow-hidden mb-2">
                  {covers[a.id]?.thumbnailUrl ? (
                    <img src={covers[a.id]!.thumbnailUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-inkFaint">
                      <ImageIcon size={22} />
                    </div>
                  )}
                </div>
                <div className="px-1">
                  <div className="text-sm font-semibold truncate group-hover:text-accent">{a.name}</div>
                  <div className="text-xs text-inkSoft">{formatDate(a.updatedAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-inkSoft">{children}</div>
}
