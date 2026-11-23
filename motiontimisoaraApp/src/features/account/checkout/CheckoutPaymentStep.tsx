import { PaymentEntry } from './PaymentEntry'
import type { ReactNode } from 'react'
import { formatRonOffer } from '@/lib/money'
import { stripeConfigured } from '@/lib/stripe'
import type { PaymentMethod } from '@/api/checkout'

export const RADIO =
  'accent-primary focus-visible:outline-ring size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2'

type PaymentMethodsProps = {
  method: PaymentMethod
  allowCash: boolean
  cashBlocked: boolean
  paymentAvailable: boolean
  cardAvailable?: boolean
  switchMethod: (method: PaymentMethod) => void
}

export function CheckoutPaymentMethods({
  method,
  allowCash,
  cashBlocked,
  paymentAvailable,
  cardAvailable = stripeConfigured,
  switchMethod,
}: PaymentMethodsProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Metodă de plată</legend>
      <label className="min-h-touch-target flex items-center gap-3 text-sm">
        <input
          type="radio"
          name="payment-method"
          className={RADIO}
          checked={method === 'CARD'}
          disabled={!cardAvailable}
          onChange={() => switchMethod('CARD')}
        />
        <span>Card bancar {!cardAvailable && '(indisponibil)'}</span>
      </label>
      {allowCash && (
        <label className="min-h-touch-target flex items-center gap-3 text-sm">
          <input
            type="radio"
            name="payment-method"
            className={RADIO}
            checked={method === 'CASH'}
            disabled={cashBlocked}
            onChange={() => switchMethod('CASH')}
          />
          <span>
            Cash, la antrenor {cashBlocked && '(indisponibil — există o înscriere neplătită)'}
          </span>
        </label>
      )}
      {!paymentAvailable && (
        <p className="text-destructive text-sm">
          Nu există o metodă de plată disponibilă pentru această înscriere. Contactează clubul sau
          încearcă mai târziu.
        </p>
      )}
    </fieldset>
  )
}

export function CheckoutPaymentStep({
  summary,
  childCount,
  total,
  cashNote = 'Înscrierea rămâne în așteptare până când antrenorul confirmă încasarea sumei de',
  ...methods
}: PaymentMethodsProps & {
  summary: ReactNode
  childCount: number
  total?: number
  cashNote?: string
}) {
  return (
    <section className="space-y-6">
      {summary}
      <CheckoutPaymentMethods {...methods} />
      {methods.method === 'CARD' ? (
        <PaymentEntry childCount={childCount} />
      ) : (
        <p className="bg-muted text-muted-foreground rounded-xl p-5 text-sm">
          {cashNote}{' '}
          <strong>{total !== undefined ? formatRonOffer(total) : 'Preț indisponibil'}</strong>.
        </p>
      )}
    </section>
  )
}
