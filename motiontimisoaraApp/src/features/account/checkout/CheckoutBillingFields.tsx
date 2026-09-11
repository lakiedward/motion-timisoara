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
        value={billing.name}
        onChange={(v) => setBilling({ ...billing, name: v })}
      />
      <Field
        label="Email"
        type="email"
        value={billing.email}
        onChange={(v) => setBilling({ ...billing, email: v })}
      />
      <div className="sm:col-span-2">
        <Field
          label="Adresă"
          value={billing.addressLine1}
          onChange={(v) => setBilling({ ...billing, addressLine1: v })}
        />
      </div>
      <Field
        label="Oraș"
        value={billing.city}
        onChange={(v) => setBilling({ ...billing, city: v })}
      />
      <Field
        label="Cod poștal"
        value={billing.postalCode}
        onChange={(v) => setBilling({ ...billing, postalCode: v })}
      />
    </section>
  )
}
