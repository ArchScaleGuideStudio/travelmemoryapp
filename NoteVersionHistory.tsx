import { useEffect, useState } from 'react'
import { History, RotateCcw, X, Loader2 } from 'lucide-react'
import { NotesService } from '@services/NotesService'
import { Button } from '@components/shared/Button'
import { timeAgo, cx } from '@lib/format'

interface Version {
  versionNumber: number
  bodyMarkdown: string
  savedAt: string
}

interface Props {
  noteId: string
  open: boolean
  onClose: () => void
  onRestored?: () => void
}

export function NoteVersionHistory({ noteId, open, onClose, onRestored }: Props) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Version | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    NotesService.listVersions(noteId)
      .then((vs) => { setVersions(vs); setSelected(vs[0] ?? null) })
      .finally(() => setLoading(false))
  }, [open, noteId])

  if (!open) return null

  const handleRestore = async (v: Version) => {
    if (!confirm(`Restore version ${v.versionNumber}? Your current note will be saved as a new version first.`)) return
    setBusy(true)
    try {
      await NotesService.restoreVersion(noteId, v.versionNumber)
      onRestored?.()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md h-full bg-panel border-l border-paperEdge flex flex-col">
        <header className="px-5 py-4 border-b border-paperEdge flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-inkSoft" />
            <div>
              <h2 className="text-sm font-semibold">Version history</h2>
              <div className="text-xs text-inkSoft">Up to 20 versions kept per note</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 flex min-h-0">
          {/* Version list */}
          <div className="w-32 border-r border-paperEdge overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-inkSoft"><Loader2 size={14} className="animate-spin" /></div>
            ) : versions.length === 0 ? (
              <div className="p-3 text-xs text-inkFaint text-center">No prior versions yet</div>
            ) : (
              versions.map((v) => (
                <button
                  key={v.versionNumber}
                  onClick={() => setSelected(v)}
                  className={cx(
                    'w-full text-left px-3 py-2.5 border-b border-paperEdge text-xs hover:bg-paper',
                    selected?.versionNumber === v.versionNumber && 'bg-accentSoft/40',
                  )}
                >
                  <div className="font-semibold">v{v.versionNumber}</div>
                  <div className="text-inkFaint">{timeAgo(v.savedAt)}</div>
                </button>
              ))
            )}
          </div>

          {/* Selected version preview */}
          <div className="flex-1 flex flex-col min-h-0">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-paperEdge flex items-center justify-between">
                  <div className="text-xs text-inkSoft">Saved {timeAgo(selected.savedAt)}</div>
                  <Button
                    size="sm"
                    icon={<RotateCcw size={12} />}
                    disabled={busy}
                    onClick={() => handleRestore(selected)}
                  >
                    Restore
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                  <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-ink">
                    {selected.bodyMarkdown || <span className="text-inkFaint italic">Empty</span>}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-inkFaint text-sm">
                Select a version
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
