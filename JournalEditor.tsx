import { useState, useEffect } from 'react'
import { useAutoSave } from '@hooks/useAutoSave'
import { SaveStatus } from '@components/shared/SaveStatus'

interface Props {
  initialTitle?: string
  initialBody: string
  placeholder?: string
  /** Called whenever the value should be persisted. Should throw on failure. */
  onSave: (next: { title: string; bodyMarkdown: string }) => Promise<void>
  minHeight?: number
  showTitle?: boolean
}

/**
 * Auto-saving journal editor.
 * - Saves 1500ms after the last keystroke
 * - Status badge shows idle/dirty/saving/saved/error
 * - On unmount with dirty content, fires a final save (best-effort)
 */
export function JournalEditor({
  initialTitle = '', initialBody, placeholder, onSave, minHeight = 220, showTitle = true,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody]   = useState(initialBody)

  useEffect(() => { setTitle(initialTitle) }, [initialTitle])
  useEffect(() => { setBody(initialBody) },   [initialBody])

  const { status, lastSavedAt } = useAutoSave({
    value: { title, bodyMarkdown: body },
    initialValue: { title: initialTitle, bodyMarkdown: initialBody },
    onSave,
    delay: 1500,
    isEqual: (a, b) => a.title === b.title && a.bodyMarkdown === b.bodyMarkdown,
  })

  return (
    <div className="bg-panel border border-paperEdge rounded-xl overflow-hidden">
      {showTitle && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full px-5 pt-4 pb-2 text-lg font-semibold bg-transparent outline-none placeholder:text-inkFaint"
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder ?? 'Write what happened. Sights, smells, who you were with, what you ate, what you felt.'}
        style={{ minHeight }}
        className="w-full px-5 py-3 bg-transparent outline-none resize-y text-[15px] leading-relaxed placeholder:text-inkFaint"
      />
      <div className="px-5 py-2 border-t border-paperEdge bg-paper flex items-center justify-between">
        <SaveStatus status={status} lastSavedAt={lastSavedAt} />
        <div className="text-[10px] text-inkFaint">Markdown supported</div>
      </div>
    </div>
  )
}
