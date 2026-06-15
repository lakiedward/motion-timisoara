import { Outlet } from 'react-router-dom'

import { Header } from '@/layout/Header'
import { Footer } from '@/layout/Footer'
import { FabAccount } from '@/layout/FabAccount'

/** Public site shell: header + page content + footer. */
export default function CoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <FabAccount />
    </div>
  )
}
