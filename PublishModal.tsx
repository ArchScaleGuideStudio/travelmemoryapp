import { useState, useEffect } from 'react'
import {
  X, ExternalLink, Globe, Copy, Check, AlertCircle, Loader2, MapPin,
  Image as ImageIcon, Music, FileText, Search as SearchIcon,
} from 'lucide-react'
import { PublicationsService, PublicationPlatform, Publication } from '@services/PublicationsService'
import { PlacesService } from '@services/PlacesService'
import { PublicReviewsService } from '@services/PublicReviewsService'
import { GoogleMapsAdapter } from '@infra/googleMaps'
import { Button } from '@components/shared/Button'
import { cx, timeAgo } from '@lib/format'
import type { PublicReview, Place } from '@domain/types'

interface Props {
  review: PublicReview
  open: boolean
  onClose: () => void
  onPublished?: () => void
}

const PLATFORMS: { id: PublicationPlatform; label: string; icon: any; description: string; available: boolean }[] = [
  { id: 'google_maps', label: 'Google Maps', icon: MapPin, description: 'Opens Google Maps to post your review (requires Place ID)', available: true },
  { id: 'app_website', label: 'Your atlas site', icon: Globe, description: 'A shareable public URL at /r/<slug>', available: true },
  { id: 'tripadvisor', label: 'TripAdvisor', icon: ImageIcon, description: 'Opens TripAdvisor search for manual posting', available: true },
  { id: 'medium',      label: 'Medium',      icon: FileText,  description: 'Opens a new Medium draft with your title', available: true },
  { id: 'instagram',   label: 'Instagram',   icon: Music,     description: 'Opens Instagram (manual posting only)', available: true },
]

export function PublishModal({ review, open, onClose, onPublished }: Props) {
  const [place, setPlace] = useState<Place | null>(null)
  const [publications, setPublications] = useState<Publication[]>([])
  const [busyPlatform, setBusyPlatform] = useState<PublicationPlatform | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPlaceMatcher, setShowPlaceMatcher] = useState(false)

  useEffect(() => {
    if (!open) return
    if (review.placeId) void PlacesService.get(review.placeId).then(setPlace)
    void PublicationsService.listForReview(review.id).then(setPublications)
  }, [open, review.id, review.placeId])

  if (!open) return null

  const handlePublish = async (platform: PublicationPlatform) => {
    setError(null)
    setBusyPlatform(platform)
    try {
      if (platform === 'google_maps') {
        if (!review.googlePlaceId) {
          setError('Add a Google Place ID to syndicate to Google Maps.')
          setShowPlaceMatcher(true)
          return
        }
        await PublicationsService.syndicateToGoogleMaps(review)
      } else if (platform === 'app_website') {
        const result = await PublicationsService.publishToWebsite(review)
        setShareUrl(result.shareUrl)
      } else {
        await PublicationsService.syndicateStub(review, platform)
      }
      // Update review status to 'published' on first successful syndication
      if (review.status !== 'published') {
        await PublicReviewsService.update(review.id, { status: 'published' })
        onPublished?.()
      }
      const list = await PublicationsService.listForReview(review.id)
      setPublications(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed')
    } finally {
      setBusyPlatform(null)
    }
  }

  const copyShare = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-paper border border-paperEdge rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <header className="px-5 py-4 border-b border-paperEdge flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={15} className="text-accent" />
            <div>
              <h2 className="text-sm font-semibold tracking-tightish">Publish review</h2>
              <div className="text-xs text-inkSoft truncate max-w-[260px]">{review.title}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-3 py-2 text-xs flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {showPlaceMatcher && place && (
            <GooglePlaceMatcher
              place={place}
              onMatched={async (placeId) => {
                await PublicReviewsService.update(review.id, { googlePlaceId: placeId })
                review.googlePlaceId = placeId
                setShowPlaceMatcher(false)
                setError(null)
              }}
              onCancel={() => setShowPlaceMatcher(false)}
            />
          )}

          {shareUrl && (
            <div className="bg-success/10 border border-success/30 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider2 text-success font-semibold mb-1">Published</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-paper border border-paperEdge rounded px-2 py-1 truncate">
                  {shareUrl}
                </code>
                <Button size="sm" variant="secondary" onClick={copyShare}>
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold mb-2">Platforms</div>
            <div className="space-y-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon
                const existing = publications.find((pub) => pub.platform === p.id)
                const busy = busyPlatform === p.id
                return (
                  <div key={p.id} className="bg-panel border border-paperEdge rounded-lg p-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-paperDeep flex items-center justify-center text-inkSoft shrink-0">
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{p.label}</div>
                        {existing && (
                          <span className={cx(
                            'text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                            existing.status === 'live' ? 'bg-success/20 text-success'
                              : existing.status === 'sent' ? 'bg-accentSoft text-accentDeep'
                              : 'bg-paperDeep text-inkSoft',
                          )}>
                            {existing.status}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-inkSoft">{p.description}</div>
                      {existing && existing.externalUrl && (
                        <a
                          href={existing.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-accent hover:text-accentDeep inline-flex items-center gap-1 mt-1"
                        >
                          Open <ExternalLink size={9} />
                        </a>
                      )}
                      {existing && existing.queuedAt && (
                        <div className="text-[10px] text-inkFaint mt-0.5">{timeAgo(existing.queuedAt)}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={existing ? 'secondary' : 'primary'}
                      disabled={busy}
                      onClick={() => handlePublish(p.id)}
                    >
                      {busy ? <Loader2 size={11} className="animate-spin" /> :
                        existing ? 'Re-publish' : 'Publish'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="text-[11px] text-inkFaint leading-relaxed">
            <strong>About Google Maps:</strong> Google does not allow apps to post reviews on your behalf.
            We open Google Maps with your selected place so you can paste and post the review yourself.
            <br /><br />
            <strong>About your atlas site:</strong> Creates a public page at a stable URL that anyone can read.
            Your private journal remains private.
          </div>
        </div>
      </div>
    </div>
  )
}

function GooglePlaceMatcher({
  place, onMatched, onCancel,
}: { place: Place; onMatched: (placeId: string) => Promise<void>; onCancel: () => void }) {
  const [manualId, setManualId] = useState('')
  const [candidates, setCandidates] = useState<{ placeId: string; name: string; address: string }[] | null>(null)
  const [searching, setSearching] = useState(false)
  const isConfigured = GoogleMapsAdapter.isConfigured()

  useEffect(() => {
    if (!isConfigured) return
    setSearching(true)
    PublicationsService.matchGooglePlace(place)
      .then((r) => setCandidates(r.matches))
      .finally(() => setSearching(false))
  }, [place.id, isConfigured])

  return (
    <div className="bg-accentSoft/30 border border-accentSoft rounded-lg p-3 space-y-3">
      <div>
        <div className="text-sm font-semibold mb-1">Match this place on Google Maps</div>
        <div className="text-xs text-inkSoft">
          Paste the Google Place ID below, or use the search button to look it up.
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
          className="flex-1 bg-paper border border-paperEdge rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-ink"
        />
        <Button size="sm" disabled={!manualId.trim()} onClick={() => onMatched(manualId.trim())}>Use this</Button>
      </div>

      <a
        href={GoogleMapsAdapter.buildSearchUrl(place)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-accent hover:text-accentDeep"
      >
        <SearchIcon size={12} /> Find on Google Maps <ExternalLink size={10} />
      </a>
      <p className="text-[10px] text-inkFaint leading-relaxed">
        On the place page in Google Maps: share button → embed map → the Place ID is shown in the URL.
        Or use the official tool: <a className="underline" href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer">Place ID Finder</a>.
      </p>

      {isConfigured && (
        <>
          <div className="border-t border-accentSoft pt-2">
            <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold mb-1">Suggestions</div>
            {searching ? (
              <div className="text-xs text-inkSoft flex items-center gap-2"><Loader2 size={11} className="animate-spin" /> Searching…</div>
            ) : candidates && candidates.length === 0 ? (
              <div className="text-xs text-inkSoft">No matches near these coordinates.</div>
            ) : candidates && candidates.length > 0 ? (
              <div className="space-y-1">
                {candidates.map((c) => (
                  <button
                    key={c.placeId}
                    onClick={() => onMatched(c.placeId)}
                    className="w-full text-left px-2 py-1.5 bg-paper rounded hover:bg-paperDeep text-xs"
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-inkFaint truncate">{c.address}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      <button onClick={onCancel} className="text-xs text-inkSoft hover:text-ink">Cancel</button>
    </div>
  )
}
