import { Outlet } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { NativeOAuthListener } from '@/features/auth/native/NativeOAuthListener'

export default function RootLayout() {
  return (
    <>
      <NativeOAuthListener />
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  )
}
