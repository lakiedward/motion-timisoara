import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { App } from '@capacitor/app'
import { nativePaymentsSupported, onNativePaymentResult } from '@/api/payments/native'

export function NativePaymentListener() {
  const qc = useQueryClient()
  useEffect(() => {
    if (!nativePaymentsSupported()) return
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ['enrollments'] })
      void qc.invalidateQueries({ queryKey: ['enrollment-payment'] })
    }
    const resume = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) refresh()
    })
    const result = onNativePaymentResult(refresh)
    return () => {
      void resume.then((handle) => handle.remove()).catch(() => undefined)
      void result.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [qc])
  return null
}
