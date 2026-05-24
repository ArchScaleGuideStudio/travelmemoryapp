import { useEffect } from 'react'
import { AuthProvider } from '@hooks/useAuth'
import { AppRoutes } from './routes'
import { MobileBottomNav } from '@components/shared/MobileBottomNav'
import { isNative, platform } from '@infra/platform'

export default function App() {
  useEffect(() => {
    // Apply platform class for any platform-specific CSS hooks
    document.documentElement.dataset.platform = platform()
    if (isNative()) document.documentElement.classList.add('is-native')
  }, [])

  return (
    <AuthProvider>
      <div className="min-h-full pb-16 md:pb-0">
        <AppRoutes />
      </div>
      <MobileBottomNav />
    </AuthProvider>
  )
}
