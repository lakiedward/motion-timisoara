import { Outlet } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { NativeOAuthListener } from '@/features/auth/native/NativeOAuthListener'
import { NativePushListener } from '@/features/notifications/NativePushListener'
import { NativePaymentListener } from '@/features/account/checkout/NativePaymentListener'

export default function RootLayout() {
  return (
    <>
      <NativeOAuthListener />
      <NativePushListener />
      <NativePaymentListener />
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  )
}
