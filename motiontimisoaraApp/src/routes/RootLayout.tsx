import { Outlet } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { NativeOAuthListener } from '@/features/auth/native/NativeOAuthListener'
import { NativePushListener } from '@/features/notifications/NativePushListener'
import { NativePaymentListener } from '@/features/account/checkout/NativePaymentListener'
import { NativeAppShell } from '@/layout/native/NativeAppShell'
import { usesNativeNavigation } from '@/layout/native/native-runtime'
import { useAuth } from '@/lib/auth-context'

export default function RootLayout() {
  const { user } = useAuth()
  return (
    <>
      <NativeOAuthListener />
      <NativePushListener />
      <NativePaymentListener />
      {usesNativeNavigation() ? (
        <NativeAppShell role={user?.role ?? null}>
          <Outlet />
        </NativeAppShell>
      ) : (
        <Outlet />
      )}
      <Toaster richColors position="top-center" />
    </>
  )
}
