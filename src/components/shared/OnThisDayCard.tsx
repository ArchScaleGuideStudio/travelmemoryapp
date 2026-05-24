import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@infra/supabase'
import { supabaseStorage } from '@infra/storage/SupabaseStorage'
import { useAuth } from '@hooks/useAuth'
import type { Media } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string }

/**
 * Shows photos taken on this calendar day in previous years.
 * Returns null if there are no matches — keeps dashboard clean.
 */
export function OnThisDayCard() {
  const { user } = useAuth()
  const [items, setItems] = useState<MediaWithUrls[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      // Match by month and day across all years
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const pattern = `%-${mm}-${dd}T%`
      const { data } = await supabase.from('media')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('kind', 'photo')
        .ilike('taken_at', pattern)
        .order('taken_at', { ascending: false })
        .limit(8)

      const list: MediaWithUrls[] = (data ?? []).map((r: any) => ({
        id: r.id, userId: r.user_id, placeId: r.place_id, visitId: r.visit_id,
        visitDayId: r.visit_day_id, tripId: r.trip_id, kind: r.kind,
        storageProvider: r.storage_provider, originalPath: r.original_path,
        previewPath: r.preview_path, thumbnailPath: r.thumbnail_path,
        width: r.width, height: r.height, fileSizeBytes: r.file_size_bytes,
        mimeType: r.mime_type, originalFilename: r.original_filename,
        takenAt: r.taken_at, capturedLat: r.captured_lat, capturedLng: r.captured_lng,
        caption: r.caption, altText: r.alt_text,
        perceptualHash: r.perceptual_hash, contentHash: r.content_hash,
        exif: r.exif ?? {}, isCover: false,
        createdAt: r.created_at,
      }))
      await Promise.all(list.map(async (m) => {
        if (!m.thumbnailPath) return
        try { m.thumbnailUrl = await supabaseStorage.getSignedUrl(m.thumbnailPath, { expiresIn: 3600 }) } catch {}
      }))
      setItems(list)
      setLoaded(true)
    })()
  }, [user?.id])

  if (!loaded || items.length === 0) return null

  return (
    <Link
      to="/gallery"
      className="block bg-panel border border-paperEdge rounded-xl p-4 mb-6 hover:border-inkFaint transition-colors group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accentSoft text-accentDeep flex items-center justify-center">
            <Sparkles size={13} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider2 text-inkFaint font-semibold">On this day</div>
            <div className="text-sm font-semibold">From {items.length} previous year{items.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <ArrowRight size={14} className="text-inkFaint group-hover:text-ink transition-colors" />
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {items.slice(0, 8).map((m) => (
          <div key={m.id} className="aspect-square bg-paperDeep rounded overflow-hidden">
            {m.thumbnailUrl ? (
              <img src={m.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-inkFaint"><ImageIcon size={14} /></div>
            )}
          </div>
        ))}
      </div>
    </Link>
  )
}
