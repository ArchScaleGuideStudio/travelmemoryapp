import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, User as UserIcon, Download, Archive, ExternalLink,
  LogOut, Globe, Loader2, CheckCircle2, AlertCircle, Trash2, BookOpen,
} from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { ExportService, ExportJob } from '@services/ExportService'
import { MemoryBookService } from '@services/MemoryBookService'
import { Button } from '@components/shared/Button'
import { EmptyState } from '@components/shared/EmptyState'
import { formatDate, formatBytes, cx } from '@lib/format'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [jobs, setJobs] = useState<ExportJob[]>([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!user) return
    setJobs(await ExportService.list(user.id))
  }
  useEffect(() => { void load() /* eslint-disable-next-line */ }, [user?.id])

  const handleExport = async () => {
    if (!user) return
    setBusy(true)
    try {
      await ExportService.queueExport({ userId: user.id, scope: 'everything', format: 'zip' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-semibold">Settings</h1>
          <div className="text-xs text-inkSoft">Account, backup, exports, danger zone</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Account */}
        <SettingSection icon={<UserIcon size={15} />} title="Account">
          <Row label="Email" value={user?.email ?? ''} />
          <Row label="User ID" value={user?.id ?? ''} mono />
          <Row label="Signed up" value={user?.created_at ? formatDate(user.created_at) : '—'} />
          <div className="pt-3 border-t border-paperEdge">
            <Button variant="secondary" icon={<LogOut size={13} />} onClick={signOut}>
              Sign out
            </Button>
          </div>
        </SettingSection>

        {/* Public reviews */}
        <SettingSection icon={<Globe size={15} />} title="Public reviews">
          <p className="text-sm text-inkSoft mb-3">
            Author content separate from your private journal — reviews you can publish to Google Maps,
            your own website, and other platforms.
          </p>
          <div className="flex gap-2">
            <Link to="/public-reviews"><Button variant="secondary">Manage reviews</Button></Link>
            <Link to="/public-reviews/new"><Button>Write a new review</Button></Link>
          </div>
        </SettingSection>

        {/* Export */}
        <SettingSection icon={<Download size={15} />} title="Export your atlas">
          <p className="text-sm text-inkSoft mb-3">
            Download a complete ZIP archive of your atlas — original photos, journal entries, places, and trips.
            Your data is yours; export it whenever you want.
          </p>
          <Button onClick={handleExport} disabled={busy} icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}>
            {busy ? 'Queuing…' : 'Queue full export'}
          </Button>
          <Button
            variant="secondary"
            className="ml-2"
            icon={<BookOpen size={13} />}
            onClick={() => user && MemoryBookService.openForEverything(user.id).catch((e) => alert(e.message))}
          >
            Print as memory book
          </Button>

          {jobs.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold mb-1">Recent exports</div>
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center gap-3 px-3 py-2 bg-paper border border-paperEdge rounded-lg text-xs">
                  <StatusIcon status={j.status} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{j.scope === 'everything' ? 'Full atlas' : j.scope} · {j.format.toUpperCase()}</div>
                    <div className="text-inkFaint">
                      {formatDate(j.createdAt)}
                      {j.fileSizeBytes && ` · ${formatBytes(j.fileSizeBytes)}`}
                      {j.status === 'queued' && ' · waiting for the export worker'}
                    </div>
                  </div>
                  {j.status === 'completed' && j.filePath && (
                    <DownloadLink job={j} />
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-inkFaint mt-3">
            Export runs via a Supabase Edge Function. Deploy <code className="font-mono">supabase/functions/export-archive</code> to enable.
          </p>
        </SettingSection>

        {/* Safety */}
        <SettingSection icon={<Archive size={15} />} title="Data safety">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SafetyCard title="Soft delete" body="Everything you delete goes to Recently Deleted for 30 days before permanent removal." />
            <SafetyCard title="Note versions" body="Up to 20 versions of each note are kept automatically. Restore any prior version anytime." />
            <SafetyCard title="Duplicate detection" body="Re-uploading the same photo links it to the new place instead of creating a copy." />
            <SafetyCard title="Per-user isolation" body="Your files live under your user folder. RLS at the database and storage layer enforces this." />
          </div>
          <div className="mt-4">
            <Link to="/recently-deleted">
              <Button variant="secondary" icon={<Trash2 size={13} />}>Open Recently Deleted</Button>
            </Link>
          </div>
        </SettingSection>

        {/* Danger zone */}
        <SettingSection icon={<AlertCircle size={15} className="text-danger" />} title="Danger zone" subtle>
          <p className="text-sm text-inkSoft mb-3">
            Permanently deleting your account removes all places, trips, photos, and reviews. There's no undo.
          </p>
          <Button variant="secondary" disabled className="opacity-60 cursor-not-allowed">
            Delete account (coming in a later phase)
          </Button>
        </SettingSection>
      </div>
    </div>
  )
}

function SettingSection({ icon, title, children, subtle }: { icon: React.ReactNode; title: string; children: React.ReactNode; subtle?: boolean }) {
  return (
    <section className={cx('bg-panel border rounded-xl p-5', subtle ? 'border-danger/30' : 'border-paperEdge')}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-paperDeep flex items-center justify-center text-inkSoft">{icon}</div>
        <h2 className="text-sm font-semibold tracking-tightish">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-4 py-2 text-sm">
      <div className="text-xs uppercase tracking-wider2 text-inkFaint font-medium w-24 shrink-0">{label}</div>
      <div className={cx('flex-1 break-all', mono && 'font-mono text-xs')}>{value || '—'}</div>
    </div>
  )
}

function SafetyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-paper border border-paperEdge rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <CheckCircle2 size={12} className="text-success" />
        <div className="text-xs font-semibold">{title}</div>
      </div>
      <div className="text-[11px] text-inkSoft leading-relaxed">{body}</div>
    </div>
  )
}

function StatusIcon({ status }: { status: ExportJob['status'] }) {
  if (status === 'completed') return <div className="w-7 h-7 rounded-md bg-success/20 text-success flex items-center justify-center"><CheckCircle2 size={13} /></div>
  if (status === 'failed')    return <div className="w-7 h-7 rounded-md bg-danger/20 text-danger flex items-center justify-center"><AlertCircle size={13} /></div>
  return <div className="w-7 h-7 rounded-md bg-paperDeep text-inkSoft flex items-center justify-center"><Loader2 size={13} className="animate-spin" /></div>
}

function DownloadLink({ job }: { job: ExportJob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { void ExportService.getDownloadUrl(job).then(setUrl) }, [job.id])
  if (!url) return null
  return (
    <a href={url} className="text-xs text-accent font-medium hover:text-accentDeep inline-flex items-center gap-1">
      Download <ExternalLink size={11} />
    </a>
  )
}
