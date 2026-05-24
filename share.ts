/**
 * Share adapter — Web Share API on web, native share sheet on mobile.
 *
 * Falls back to clipboard copy if neither is available.
 */

import { isNative } from './platform'

export interface ShareOptions {
  title?: string
  text?: string
  url?: string
}

export async function shareContent(opts: ShareOptions): Promise<'shared' | 'copied' | 'cancelled'> {
  if (isNative()) {
    const { Share } = await import('@capacitor/share')
    try {
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        dialogTitle: opts.title ?? 'Share',
      })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }

  // Web Share API
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share(opts)
      return 'shared'
    } catch {
      // User cancelled — fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  if (opts.url || opts.text) {
    const text = opts.url ?? opts.text ?? ''
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'cancelled'
    }
  }
  return 'cancelled'
}

/** Lightweight haptic tap on native (no-op on web) */
export async function hapticTap() {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch { /* ignore */ }
}
