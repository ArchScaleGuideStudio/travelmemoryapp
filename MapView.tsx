import { Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { WorldMap } from '@components/map/WorldMap'

export default function MapView() {
  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <header className="px-4 py-3 border-b border-paperEdge bg-panel flex items-center gap-3 z-10">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold tracking-tightish">World map</h1>
          <div className="text-xs text-inkSoft">Tap a pin to open a place. Countries darken with more cities visited.</div>
        </div>
        <Link
          to="/places/new"
          className="inline-flex items-center gap-1.5 bg-ink text-paper px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
        >
          <Plus size={13} /> Add a place
        </Link>
      </header>
      <div className="relative flex-1">
        <WorldMap />
      </div>
    </div>
  )
}
