import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useQuery } from '@tanstack/react-query'
import { isNative, platform } from '@/lib/platform'
import { stripeConfigured } from '@/lib/stripe'
import {
  confirmNativePayment,
  getNativePaymentAvailability,
  nativePaymentsSupported,
} from '@/api/payments/native'
import type { PaymentAdapter } from '@/api/payments/process'

export function usePaymentAdapter() {
  const stripe = useStripe()
  const elements = useElements()
  const android = isNative() && platform() === 'android'
  const availability = useQuery({
    queryKey: ['native-payment-availability'],
    queryFn: getNativePaymentAvailability,
    enabled: android && stripeConfigured && nativePaymentsSupported(),
    retry: false,
    staleTime: 0,
  })
  const adapter: PaymentAdapter = {
    testOnly: android,
    confirm: async (input) => {
      if (android) return confirmNativePayment(input)
      const card = elements?.getElement(CardElement)
      if (!stripe || !card) throw new Error('Formularul de card nu s-a încărcat. Reîncearcă.')
      const { billing, clientSecret } = input
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: billing.name,
            email: billing.email,
            address: {
              line1: billing.addressLine1,
              city: billing.city,
              postal_code: billing.postalCode,
              country: 'RO',
            },
          },
        },
      })
      if (error) throw new Error(error.message ?? 'Plata nu a reușit.')
      return 'completed'
    },
  }
  return {
    android,
    availability,
    adapter,
    ready:
      stripeConfigured &&
      (android ? nativePaymentsSupported() && availability.isSuccess : Boolean(stripe && elements)),
  }
}
