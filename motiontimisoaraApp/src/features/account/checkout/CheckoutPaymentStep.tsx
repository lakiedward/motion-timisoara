import { PaymentEntry } from './PaymentEntry'
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { formatRonOffer } from '@/lib/money'
import { stripeConfigured } from '@/lib/stripe'
import type { PaymentMethod } from '@/api/checkout'

const RADIO =
  'accent-primary focus-visible:outline-ring size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2'

export function CheckoutPaymentStep({
  summary,
  childCount,
  total,
  method,
  allowCash,
  cashBlocked,
  paymentAvailable,
  switchMethod,
}: {
  summary: ReactNode
  childCount: number
  total?: number
  method: PaymentMethod
  allowCash: boolean
  cashBlocked: boolean
  paymentAvailable: boolean
  switchMethod: (method: PaymentMethod) => void
}) {
  return (
    <section className="space-y-6">
      {summary}

      <div className="space-y-2">
        <Label>Metodă de plată</Label>
        <label className="min-h-touch-target flex items-center gap-3 text-sm">
          <input
            type="radio"
            className={RADIO}
            checked={method === 'CARD'}
            disabled={!stripeConfigured}
            onChange={() => switchMethod('CARD')}
          />
          <span>Card bancar {!stripeConfigured && '(indisponibil — Stripe neconfigurat)'}</span>
        </label>
        {allowCash && (
          <label className="min-h-touch-target flex items-center gap-3 text-sm">
            <input
              type="radio"
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
      </div>

      {method === 'CARD' ? (
        <PaymentEntry childCount={childCount} />
      ) : (
        <p className="bg-muted text-muted-foreground rounded-xl p-5 text-sm">
          Înscrierea rămâne în așteptare până când antrenorul confirmă încasarea sumei de{' '}
          <strong>{total !== undefined ? formatRonOffer(total) : 'Preț indisponibil'}</strong>.
        </p>
      )}
    </section>
  )
}
