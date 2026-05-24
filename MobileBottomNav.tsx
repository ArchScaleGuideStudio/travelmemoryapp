import { Link, useLocation } from 'react-router-dom'
import { Compass, Map, Calendar, Image as ImageIcon, Plus } from 'lucide-react'
import { cx } from '@lib/format'
import { isNative } from '@infra/platform'

/**
 * Bottom tab bar shown on small screens and on native.
 * The center "Add" button is visually distinct — common mobile pattern.
 */
export function MobileBottomNav() {
  const location = useLocation()
  const path = location.pathname

  // Don't show on auth pages or public share pages
  if (path.startsWith('/auth') || path.startsWith('/r/')) return null

  const isActive = (target: string) => path === target || (target !== '/' && path.startsWith(target))

  return (
    <nav
      className={cx(
        'fixed bottom-0 inset-x-0 z-30 bg-panel border-t border-paperEdge',
        'md:hidden',                         // hide on tablets/desktops
        isNative() ? 'pb-[env(safe-area-inset-bottom)]' : '',
      )}
    >
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto">
        <NavItem to="/"          icon={<Compass size={20} />}    label="Atlas"     active={isActive('/') && !isActive('/map') && !isActive('/timeline') && !isActive('/gallery') && !isActive('/albums')} />
        <NavItem to="/map"       icon={<Map size={20} />}        label="Map"       active={isActive('/map')} />
        <CenterAdd to="/places/new" />
        <NavItem to="/timeline"  icon={<Calendar size={20} />}   label="Timeline"  active={isActive('/timeline')} />
        <NavItem to="/gallery"   icon={<ImageIcon size={20} />}  label="Gallery"   active={isActive('/gallery')} />
      </div>
    </nav>
  )
}

function NavItem({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={cx(
        'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
        active ? 'text-ink' : 'text-inkFaint hover:text-inkSoft',
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

function CenterAdd({ to }: { to: string }) {
  return (
    <div className="flex items-center justify-center">
      <Link
        to={to}
        className="w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center -mt-4 shadow-lg hover:opacity-90"
      >
        <Plus size={20} />
      </Link>
    </div>
  )
}
