import { useQuery } from '@tanstack/react-query'
import { isNative, platform } from '@/lib/platform'
import { stripeConfigured } from '@/lib/stripe'
import {
  confirmNativePayment,
  getNativePaymentAvailability,
  nativePaymentsSupported,
} from '@/api/payments/native'
import type { PaymentAdapter } from '@/api/payments/process'

const nativeAdapter: PaymentAdapter = {
  testOnly: true,
  confirm: (input) => confirmNativePayment(input),
}

export function usePaymentAdapter() {
  const android = isNative() && platform() === 'android'
  const availability = useQuery({
    queryKey: ['native-payment-availability'],
    queryFn: getNativePaymentAvailability,
    enabled: android && stripeConfigured && nativePaymentsSupported(),
    retry: false,
    staleTime: 0,
  })
  return {
    android,
    availability,
    adapter: nativeAdapter,
    ready: stripeConfigured && (!android || (nativePaymentsSupported() && availability.isSuccess)),
  }
}
