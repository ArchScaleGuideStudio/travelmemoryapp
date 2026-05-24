import { useEffect, useRef, useState } from 'react'

export type AutoSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface UseAutoSaveOptions<T> {
  value: T
  /** Function that saves the value. Should throw on failure. */
  onSave: (value: T) => Promise<void>
  /** ms to wait after last change before saving. Default 1500. */
  delay?: number
  /** Skip saving if the value matches this comparator. Default: shallow equality. */
  isEqual?: (a: T, b: T) => boolean
  /** Initial value (the saved baseline). If unset, defers first save until value changes. */
  initialValue?: T
}

/**
 * Auto-save hook with status tracking.
 *
 * Critical for memory-vault safety: every edit should save without user action.
 * Shows status in the UI so the user always knows whether their work is safe.
 *
 * Status flow: idle → dirty (on change) → saving → saved (then back to idle after ~2s)
 */
export function useAutoSave<T>({
  value,
  onSave,
  delay = 1500,
  isEqual = (a, b) => Object.is(a, b),
  initialValue,
}: UseAutoSaveOptions<T>): { status: AutoSaveStatus; lastSavedAt: number | null; flushNow: () => Promise<void> } {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const savedRef = useRef<T>(initialValue ?? value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflightRef = useRef<Promise<void> | null>(null)
  const onSaveRef = useRef(onSave)

  // Keep latest onSave without retriggering the effect
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  // Detect dirty and schedule save
  useEffect(() => {
    if (isEqual(value, savedRef.current)) return
    setStatus('dirty')
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { void doSave(value) }, delay)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay])

  async function doSave(toSave: T) {
    if (inflightRef.current) await inflightRef.current
    setStatus('saving')
    const promise = onSaveRef.current(toSave)
      .then(() => {
        savedRef.current = toSave
        setLastSavedAt(Date.now())
        setStatus('saved')
        // back to idle after 2s
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      })
      .catch(() => setStatus('error'))
    inflightRef.current = promise
    await promise
    inflightRef.current = null
  }

  /** Force-save immediately (for unmount, sign-out, etc.) */
  const flushNow = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (!isEqual(value, savedRef.current)) await doSave(value)
  }

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        if (!isEqual(value, savedRef.current)) {
          // best-effort fire-and-forget on unmount
          void onSaveRef.current(value).catch(() => {})
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, lastSavedAt, flushNow }
}
