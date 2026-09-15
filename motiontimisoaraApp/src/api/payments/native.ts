import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { BillingDetails } from '@/api/checkout'

export interface NativePaymentAvailability {
  googlePay: boolean
  testMode: boolean
}

interface MotionPaymentsPlugin {
  availability(input: { publishableKey: string }): Promise<NativePaymentAvailability>
  confirm(input: {
    publishableKey: string
    clientSecret: string
    billing: BillingDetails
  }): Promise<{ status: 'completed' | 'canceled' }>
  addListener(event: 'paymentResult', listener: () => void): Promise<PluginListenerHandle>
}

const MotionPayments = registerPlugin<MotionPaymentsPlugin>('MotionPayments')

export function nativePaymentsSupported(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    Capacitor.isPluginAvailable('MotionPayments')
  )
}

function publishableKey(): string {
  if (!nativePaymentsSupported()) {
    throw new Error('Plata Android nu este disponibilă în această versiune a aplicației.')
  }
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key || !/^pk_test_[A-Za-z0-9]+$/.test(key)) {
    throw new Error('Plata Android este disponibilă momentan numai în modul de test.')
  }
  return key
}

export async function getNativePaymentAvailability(): Promise<NativePaymentAvailability> {
  return MotionPayments.availability({ publishableKey: publishableKey() })
}

export async function confirmNativePayment(input: {
  clientSecret: string
  billing: BillingDetails
}): Promise<'completed' | 'canceled'> {
  const key = publishableKey()
  if (!/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(input.clientSecret)) {
    throw new Error('Datele plății nu sunt valide. Reîncearcă din înscrieri.')
  }
  try {
    const result = await MotionPayments.confirm({ ...input, publishableKey: key })
    if (result.status === 'completed' || result.status === 'canceled') return result.status
  } catch {
    throw new Error('Plata nu a putut fi confirmată. Verifică înscrierea și reîncearcă.')
  }
  throw new Error('Plata nu a putut fi confirmată. Verifică înscrierea și reîncearcă.')
}

export function onNativePaymentResult(listener: () => void): Promise<PluginListenerHandle> {
  return MotionPayments.addListener('paymentResult', listener)
}
