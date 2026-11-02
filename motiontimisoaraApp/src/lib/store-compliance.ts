import { isNative } from '@/lib/platform'

export const NATIVE_BUILD = import.meta.env.VITE_NATIVE_BUILD === '1'

export const SUBSCRIPTION_HIDDEN_NOTICE = 'Profilul tău nu apare acum în căutare.'

export function subscriptionSalesAllowed(): boolean {
  return !NATIVE_BUILD && !isNative()
}

export function webOnly<T>(items: readonly T[]): T[] {
  return subscriptionSalesAllowed() ? [...items] : []
}
