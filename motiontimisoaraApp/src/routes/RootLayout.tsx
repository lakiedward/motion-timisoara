import { Outlet } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { NativeOAuthListener } from '@/features/auth/native/NativeOAuthListener'
import { NativePushListener } from '@/features/notifications/NativePushListener'

export default function RootLayout() {
  return (
    <>
      <NativeOAuthListener />
      <NativePushListener />
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  )
}
