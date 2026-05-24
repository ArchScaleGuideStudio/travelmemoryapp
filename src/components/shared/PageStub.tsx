import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'

/**
 * Placeholder shown on every route that hasn't been fully implemented yet.
 * Gives the user (and future-you) a clear signal of what phase will build it.
 */
export function PageStub({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-paperDeep flex items-center justify-center text-inkSoft">
          <Compass size={20} />
        </div>
        <div className="text-xs uppercase tracking-wider2 text-inkFaint font-medium mb-2">
          Coming soon
        </div>
        <h1 className="text-2xl font-semibold tracking-tightish mb-2">{title}</h1>
        <p className="text-inkSoft mb-8">{subtitle}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-inkSoft hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </div>
    </div>
  )
}
