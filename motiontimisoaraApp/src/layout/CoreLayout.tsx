import { Outlet } from 'react-router-dom'

import { Header } from '@/layout/Header'
import { Footer } from '@/layout/Footer'
import { FabAccount } from '@/layout/FabAccount'
import { useAuth } from '@/lib/auth-context'
import { usesNativeNavigation } from '@/layout/native/native-runtime'

export default function CoreLayout() {
  const { user } = useAuth()
  if (usesNativeNavigation()) return <Outlet />
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <FabAccount authenticated={!!user} />
    </div>
  )
}
