/**
 * Platform detection.
 *
 * The same React code runs in three environments:
 *   - Web (browser)
 *   - iOS (Capacitor WebView)
 *   - Android (Capacitor WebView)
 *
 * Use these helpers instead of sniffing user agents in components.
 * Capacitor's `isNativePlatform()` is the canonical check, and we re-export
 * it with a safe fallback for the web build where @capacitor/core may or may
 * not be installed.
 */

let _isNative: boolean | undefined
let _platform: 'web' | 'ios' | 'android' = 'web'

try {
  // Dynamic require so the web build doesn't fail if capacitor isn't installed
  // (e.g. during early development before `npm install`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Capacitor } = await import('@capacitor/core').catch(() => ({ Capacitor: null as any }))
  if (Capacitor) {
    _isNative = Capacitor.isNativePlatform()
    const p = Capacitor.getPlatform()
    if (p === 'ios' || p === 'android') _platform = p
  }
} catch {
  _isNative = false
}

export const isNative = (): boolean => _isNative ?? false
export const isWeb    = (): boolean => !_isNative
export const platform = (): 'web' | 'ios' | 'android' => _platform
export const isIOS    = (): boolean => _platform === 'ios'
export const isAndroid = (): boolean => _platform === 'android'
