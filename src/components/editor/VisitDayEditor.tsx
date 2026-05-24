import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import {
  ChevronDown, ChevronUp, Sun, Cloud, CloudSnow, CloudRain,
  BookOpen, Globe, Heart, MapPin, Plus, X, Check, Loader2,
} from 'lucide-react'
import { VisitDaysService } from '@services/VisitDaysService'
import { SaveStatus } from '@components/shared/SaveStatus'
import type { VisitDay, JournalItem } from '@domain/types'
import { cx } from '@lib/format'

interface Props {
  day: VisitDay
  onChange: (updated: VisitDay) => void
  defaultExpanded?: boolean
}

/**
 * Per-day editor with four collapsible sections:
 *   1. Journal             — freeform body + weather + mood
 *   2. Public Publish      — toggle + optional public summary
 *   3. Key Memories        — bullet list (text-only)
 *   4. Key Points / Places — bullet list (can attach coords later)
 *
 * All edits debounce-save after 1.1s of inactivity.
 */
export function VisitDayEditor({ day, onChange, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded || day.dayNumber <= 2)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    journal: true, publish: false, memories: true, points: true,
  })
  const [status, setStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = (patch: Partial<VisitDay>) => {
    const updated = { ...day, ...patch }
    onChange(updated)
    setStatus('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setStatus('saving')
      try {
        await VisitDaysService.update(day.id, patch)
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 1500)
      } catch {
        setStatus('idle')
      }
    }, 1100)
  }

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="bg-panel border border-paperEdge rounded-xl overflow-hidden mb-3">
      {/* Day header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-accentSoft text-accentDeep flex items-center justify-center font-semibold text-sm">
          {day.dayNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{day.title || `Day ${day.dayNumber}`}</div>
          <div className="text-xs text-inkSoft flex items-center gap-2">
            <span>{day.date}</span>
            {day.weather && <span>· {day.weather}</span>}
            {day.mood && <span>· {day.mood}</span>}
            {day.isPublishable && (
              <span className="inline-flex items-center gap-1 text-success">
                <Globe size={10} /> Publishable
              </span>
            )}
          </div>
        </div>
        <SaveStatus status={status} />
        <span className="text-inkFaint">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {expanded && (
        <div className="border-t border-paperEdge">
          {/* Section 1 — Journal */}
          <Section
            icon={<BookOpen size={14} />}
            title="Journal"
            subtitle="The freeform daily entry"
            open={openSections.journal}
            onToggle={() => toggle('journal')}
          >
            <input
              value={day.title ?? ''}
              onChange={e => scheduleSave({ title: e.target.value })}
              placeholder={`Day ${day.dayNumber} title — e.g. "Gulmarg Gondola"`}
              className="w-full bg-paper border border-paperEdge rounded-lg px-3 py-2 text-sm font-medium mb-2 outline-none focus:border-ink"
            />
            <textarea
              value={day.bodyMarkdown ?? ''}
              onChange={e => scheduleSave({ bodyMarkdown: e.target.value })}
              placeholder="What happened today? Where did you go, what did you eat, who did you meet?"
              className="w-full bg-paper border border-paperEdge rounded-lg px-3 py-2.5 text-sm leading-relaxed min-h-[120px] outline-none focus:border-ink resize-y"
            />

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Label>Weather</Label>
              {[
                { v: 'sunny',  icon: <Sun     size={11} />, label: 'Sunny'  },
                { v: 'cloudy', icon: <Cloud   size={11} />, label: 'Cloudy' },
                { v: 'rainy',  icon: <CloudRain size={11} />, label: 'Rainy'  },
                { v: 'snowy',  icon: <CloudSnow size={11} />, label: 'Snowy'  },
              ].map(w => {
                const active = day.weather === w.v
                return (
                  <Chip
                    key={w.v}
                    active={active}
                    onClick={() => scheduleSave({ weather: active ? undefined : w.v })}
                  >
                    {w.icon} {w.label}
                  </Chip>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Label>Mood</Label>
              {['😊','🤩','😌','😢','🥶','🌶️','🥹'].map(emoji => {
                const active = day.mood === emoji
                return (
                  <button
                    key={emoji}
                    onClick={() => scheduleSave({ mood: active ? undefined : emoji })}
                    className={cx(
                      'w-7 h-7 rounded-md flex items-center justify-center text-base',
                      active ? 'bg-ink' : 'bg-paper border border-paperEdge hover:border-inkFaint',
                    )}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Section 2 — Public Publish */}
          <Section
            icon={<Globe size={14} />}
            title="Public publish"
            subtitle={day.isPublishable
              ? 'This day will appear as a publishable review candidate'
              : 'Private by default — toggle on to make this day shareable'}
            open={openSections.publish}
            onToggle={() => toggle('publish')}
          >
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={day.isPublishable}
                onChange={e => scheduleSave({ isPublishable: e.target.checked })}
                className="w-4 h-4 accent-accent"
              />
              <div>
                <div className="text-sm font-medium">Mark this day as publishable</div>
                <div className="text-xs text-inkSoft">
                  Allowed to flow into Google Maps reviews and public web pages. Your private journal stays private regardless.
                </div>
              </div>
            </label>

            {day.isPublishable && (
              <div className="ml-7">
                <Label>Public summary (optional)</Label>
                <textarea
                  value={day.publicSummary ?? ''}
                  onChange={e => scheduleSave({ publicSummary: e.target.value })}
                  placeholder="A polished version of this day for public eyes. Leave blank to use the journal excerpt automatically."
                  className="mt-1 w-full bg-paper border border-paperEdge rounded-lg px-3 py-2 text-sm leading-relaxed min-h-[80px] outline-none focus:border-ink resize-y"
                />
              </div>
            )}
          </Section>

          {/* Section 3 — Key Memories */}
          <Section
            icon={<Heart size={14} />}
            title="Key memories"
            subtitle="Things to remember forever"
            count={day.keyMemories.length}
            open={openSections.memories}
            onToggle={() => toggle('memories')}
          >
            <ItemList
              items={day.keyMemories}
              placeholder='e.g. "Mom''s first time seeing snow"'
              onAdd={async (text) => {
                const item = await VisitDaysService.addItem(day.id, 'keyMemories', text)
                onChange({ ...day, keyMemories: [...day.keyMemories, item] })
              }}
              onRemove={async (id) => {
                await VisitDaysService.removeItem(day.id, 'keyMemories', id)
                onChange({ ...day, keyMemories: day.keyMemories.filter(i => i.id !== id) })
              }}
              onUpdate={async (id, text) => {
                await VisitDaysService.updateItem(day.id, 'keyMemories', id, text)
                onChange({ ...day, keyMemories: day.keyMemories.map(i => i.id === id ? { ...i, text } : i) })
              }}
            />
          </Section>

          {/* Section 4 — Key Points / Places */}
          <Section
            icon={<MapPin size={14} />}
            title="Key points / places"
            subtitle="Specific spots visited today"
            count={day.keyPoints.length}
            open={openSections.points}
            onToggle={() => toggle('points')}
            last
          >
            <ItemList
              items={day.keyPoints}
              placeholder='e.g. "Café Liberty, Nawa Bazaar — ₹40 cardamom chai"'
              onAdd={async (text) => {
                const item = await VisitDaysService.addItem(day.id, 'keyPoints', text)
                onChange({ ...day, keyPoints: [...day.keyPoints, item] })
              }}
              onRemove={async (id) => {
                await VisitDaysService.removeItem(day.id, 'keyPoints', id)
                onChange({ ...day, keyPoints: day.keyPoints.filter(i => i.id !== id) })
              }}
              onUpdate={async (id, text) => {
                await VisitDaysService.updateItem(day.id, 'keyPoints', id, text)
                onChange({ ...day, keyPoints: day.keyPoints.map(i => i.id === id ? { ...i, text } : i) })
              }}
            />
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({
  icon, title, subtitle, count, open, onToggle, children, last,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  count?: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={cx(!last && 'border-b border-paperEdge')}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-paper transition-colors"
      >
        <span className="text-inkSoft flex">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider2 flex items-center gap-2">
            {title}
            {typeof count === 'number' && count > 0 && (
              <span className="px-1.5 py-0.5 bg-accentSoft text-accentDeep rounded text-[9px]">{count}</span>
            )}
          </div>
          {subtitle && <div className="text-[11px] text-inkSoft mt-0.5">{subtitle}</div>}
        </div>
        <span className="text-inkFaint">{open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] uppercase tracking-wider2 text-inkFaint font-semibold mr-1">
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-colors',
        active ? 'bg-ink text-paper' : 'bg-paper border border-paperEdge text-inkSoft hover:border-inkFaint',
      )}
    >
      {children}
    </button>
  )
}

function ItemList({
  items, placeholder, onAdd, onRemove, onUpdate,
}: {
  items: JournalItem[]
  placeholder: string
  onAdd: (text: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onUpdate: (id: string, text: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const submit = async () => {
    const t = draft.trim()
    if (!t) return
    setAdding(true)
    try {
      await onAdd(t)
      setDraft('')
    } finally {
      setAdding(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void submit() }
  }

  return (
    <div>
      {items.length === 0 && (
        <div className="text-[12px] text-inkFaint italic mb-2">No items yet — add the first one below.</div>
      )}
      <ul className="space-y-1.5 mb-2">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-2 group">
            <span className="text-accent mt-1.5 leading-none">•</span>
            {editingId === item.id ? (
              <>
                <input
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={async () => {
                    if (editText.trim() && editText !== item.text) {
                      await onUpdate(item.id, editText.trim())
                    }
                    setEditingId(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') { setEditingId(null) }
                  }}
                  className="flex-1 bg-paper border border-ink rounded px-2 py-1 text-sm outline-none"
                />
              </>
            ) : (
              <>
                <button
                  onClick={() => { setEditingId(item.id); setEditText(item.text) }}
                  className="flex-1 text-sm text-left leading-relaxed py-0.5 hover:bg-paper rounded px-1"
                >
                  {item.text}
                </button>
                <button
                  onClick={() => onRemove(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-inkFaint hover:text-danger transition-opacity p-1"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="flex-1 bg-paper border border-paperEdge rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || adding}
          className="px-3 py-2 bg-ink text-paper rounded-lg text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1"
        >
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add
        </button>
      </div>
    </div>
  )
}
