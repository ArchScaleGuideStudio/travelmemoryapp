import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-paperDeep flex items-center justify-center text-inkSoft">
          <Compass size={20} />
        </div>
        <div className="text-xs uppercase tracking-wider2 text-inkFaint font-medium mb-2">
          404
        </div>
        <h1 className="text-2xl font-semibold tracking-tightish mb-2">Off the map</h1>
        <p className="text-inkSoft mb-8">
          This page doesn't exist — or hasn't been built yet.
        </p>
        <Link to="/" className="text-sm font-medium text-accent hover:text-accentDeep">
          ← Back to your atlas
        </Link>
      </div>
    </div>
  )
}
