import { ReactNode } from 'react'

export function EmptyState({
  icon, title, subtitle, action,
}: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6 bg-panel rounded-2xl border border-paperEdge">
      <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-paperDeep flex items-center justify-center text-inkSoft">
        {icon}
      </div>
      <div className="text-base font-semibold mb-1">{title}</div>
      {subtitle && <p className="text-sm text-inkSoft max-w-sm mx-auto mb-5">{subtitle}</p>}
      {action}
    </div>
  )
}
