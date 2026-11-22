import {
  invokeCheckoutFunction,
  type BillingDetails,
  type ChildValidation,
  type PaymentMethod,
} from '@/api/checkout'
import { choiceRequest, type CheckoutChoice } from '@/lib/course-packages/checkout-choice'

export interface OpenRenewalPayment {
  id: string
  method: PaymentMethod
  status: string
  amount: number
  sessions: number | null
  started: boolean
  expiredMonth?: boolean
}

export type RenewalQuote = ChildValidation & {
  enrollmentId: string
  courseId: string
  remainingSessions: number
  openPayment: OpenRenewalPayment | null
}

export interface RenewalValidation {
  renewal: RenewalQuote
  allowCash: boolean
}

export interface RenewalResult {
  enrollmentId: string
  enrollmentIds: string[]
  paymentId: string
  requiresPaymentIntent: boolean
}

export function validateRenewal(
  enrollmentId: string,
  choice: CheckoutChoice,
): Promise<RenewalValidation> {
  return invokeCheckoutFunction<RenewalValidation>('validate-enrollment', {
    renewEnrollmentId: enrollmentId,
    ...choiceRequest(choice),
  })
}

export function renewEnrollment(input: {
  enrollmentId: string
  choice: CheckoutChoice
  paymentMethod: PaymentMethod
  priceVersion: string
  billingDetails?: BillingDetails
  acceptance: { termsVersion: string; rulesFingerprint?: string }
}): Promise<RenewalResult> {
  return invokeCheckoutFunction<RenewalResult>('create-enrollment', {
    renewEnrollmentId: input.enrollmentId,
    ...choiceRequest(input.choice),
    paymentMethod: input.paymentMethod,
    priceVersion: input.priceVersion,
    billingDetails: input.billingDetails,
    acceptance: input.acceptance,
  })
}
