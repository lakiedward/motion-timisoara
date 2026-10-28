import type { BillingDetails } from '@/api/checkout'
import { Field } from './CheckoutFormFields'

export function CheckoutBillingFields({
  billing,
  setBilling,
}: {
  billing: BillingDetails
  setBilling: (billing: BillingDetails) => void
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Nume complet"
        autoComplete="name"
        value={billing.name}
        onChange={(v) => setBilling({ ...billing, name: v })}
      />
      <Field
        label="Email"
        autoComplete="email"
        type="email"
        value={billing.email}
        onChange={(v) => setBilling({ ...billing, email: v })}
      />
      <div className="sm:col-span-2">
        <Field
          label="Adresă"
          autoComplete="address-line1"
          value={billing.addressLine1}
          onChange={(v) => setBilling({ ...billing, addressLine1: v })}
        />
      </div>
      <Field
        label="Oraș"
        autoComplete="address-level2"
        value={billing.city}
        onChange={(v) => setBilling({ ...billing, city: v })}
      />
      <Field
        label="Cod poștal"
        autoComplete="postal-code"
        value={billing.postalCode}
        onChange={(v) => setBilling({ ...billing, postalCode: v })}
      />
    </section>
  )
}
