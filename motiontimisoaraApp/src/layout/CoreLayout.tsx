import { Outlet, useLocation } from 'react-router-dom'

import { Header } from '@/layout/Header'
import { Footer } from '@/layout/Footer'
import { FabAccount } from '@/layout/FabAccount'
import { isFabAccountVisible } from '@/layout/fab-account'
import { useAuth } from '@/lib/auth-context'
import { usesNativeNavigation } from '@/layout/native/native-runtime'
import { cn } from '@/lib/utils'

export default function CoreLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (usesNativeNavigation()) return <Outlet />
  const fabVisible = isFabAccountVisible(!!user, pathname)
  return (
    <div className={cn('flex min-h-dvh flex-col', fabVisible && 'pb-20 lg:pb-0')}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <FabAccount visible={fabVisible} />
    </div>
  )
}
