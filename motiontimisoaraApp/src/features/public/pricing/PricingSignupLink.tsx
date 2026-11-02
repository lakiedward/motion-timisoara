import { Link } from 'react-router-dom'

import { NATIVE_BUILD, subscriptionSalesAllowed } from '@/lib/store-compliance'

export function PricingSignupLink() {
  if (NATIVE_BUILD || !subscriptionSalesAllowed()) return null
  return (
    <p className="mt-2">
      <Link
        to="/preturi"
        className="text-primary min-h-touch-target inline-flex items-center font-semibold underline-offset-4 hover:underline"
      >
        Vezi prețurile abonamentelor
      </Link>
    </p>
  )
}
