import type { RouteObject } from 'react-router-dom'

import ClubSubscriptionPage from '@/features/club/subscription/ClubSubscriptionPage'
import PricingPage from '@/features/public/pricing/PricingPage'

export const SUBSCRIPTION_ROUTES: RouteObject[] = [{ path: '/preturi', element: <PricingPage /> }]

export const CLUB_SUBSCRIPTION_ROUTES: RouteObject[] = [
  { path: '/club/abonament', element: <ClubSubscriptionPage /> },
]
