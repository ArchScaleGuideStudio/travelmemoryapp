/**
 * Memory book generation.
 *
 * Opens the server-rendered HTML in a new tab; the page auto-triggers
 * window.print() so the user can save it as PDF.
 */

import { supabase } from '@infra/supabase'
import { isNative } from '@infra/platform'

export const MemoryBookService = {
  /** Opens the memory book for a trip in a new tab/window. */
  async openForTrip(tripId: string, userId: string): Promise<void> {
    return openBook({ scope: 'trip', scope_id: tripId, user_id: userId })
  },

  async openForPlace(placeId: string, userId: string): Promise<void> {
    return openBook({ scope: 'place', scope_id: placeId, user_id: userId })
  },

  async openForEverything(userId: string): Promise<void> {
    return openBook({ scope: 'everything', user_id: userId })
  },
}

async function openBook(body: { scope: 'trip' | 'place' | 'everything'; scope_id?: string; user_id: string }) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not signed in')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-book`

  // Edge Functions need auth — easiest cross-platform path is to do the fetch
  // here, then open the resulting HTML in a new tab via a blob URL. This works
  // on both web and native (Capacitor Browser).
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Memory book generation failed: ${await res.text()}`)
  }

  const html = await res.text()
  const blob = new Blob([html], { type: 'text/html' })
  const blobUrl = URL.createObjectURL(blob)

  if (isNative()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: blobUrl })
  } else {
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
  }
  // Revoke after a delay so the new tab has time to load it
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
}
