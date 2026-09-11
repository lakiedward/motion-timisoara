import { CardElement } from '@stripe/react-stripe-js'
import { AcceptedPriceDetails } from '@/components/AcceptedPriceDetails'
import { Label } from '@/components/ui/label'
import { formatRon } from '@/lib/money'
import { stripeConfigured } from '@/lib/stripe'
import type { PaymentMethod } from '@/api/checkout'

export function CheckoutPaymentStep({
  title,
  kindLabel,
  childCount,
  packageSize,
  snapshots,
  total,
  method,
  allowCash,
  cashBlocked,
  paymentAvailable,
  switchMethod,
}: {
  title: string
  kindLabel: string
  childCount: number
  packageSize?: number
  snapshots: unknown[]
  total?: number
  method: PaymentMethod
  allowCash: boolean
  cashBlocked: boolean
  paymentAvailable: boolean
  switchMethod: (method: PaymentMethod) => void
}) {
  return (
    <section className="space-y-6">
      <div className="bg-card shadow-card rounded-3xl p-5">
        <h2 className="mb-3 font-semibold">Sumar comandă</h2>
        {snapshots.map((snapshot, index) => (
          <AcceptedPriceDetails key={index} snapshot={snapshot} />
        ))}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{title}</span>
          <span>{kindLabel}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {childCount} {childCount === 1 ? 'copil' : 'copii'}
            {packageSize !== undefined && ` × ${packageSize} ședințe`}
          </span>
          <span className="font-semibold">
            {total !== undefined ? formatRon(total) : 'Preț indisponibil'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Metodă de plată</Label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="radio"
            checked={method === 'CARD'}
            disabled={!stripeConfigured}
            onChange={() => switchMethod('CARD')}
          />
          <span>Card bancar {!stripeConfigured && '(indisponibil — Stripe neconfigurat)'}</span>
        </label>
        {allowCash && (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="radio"
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
        <div className="bg-card shadow-card rounded-3xl p-5">
          <Label className="mb-3 block">Date card</Label>
          <div className="rounded-xl border p-3">
            <CardElement options={{ hidePostalCode: true }} />
          </div>
        </div>
      ) : (
        <p className="bg-muted text-muted-foreground rounded-3xl p-5 text-sm">
          Înscrierea rămâne în așteptare până când antrenorul confirmă încasarea sumei de{' '}
          <strong>{total !== undefined ? formatRon(total) : 'Preț indisponibil'}</strong>.
        </p>
      )}
    </section>
  )
}
