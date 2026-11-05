import type { RouteObject } from 'react-router-dom'

import ClubSubscriptionPage from '@/features/club/subscription/ClubSubscriptionPage'
import CoachSubscriptionPage from '@/features/coach/subscription/CoachSubscriptionPage'
import PricingPage from '@/features/public/pricing/PricingPage'
import { pageTitle } from '@/lib/page-title'

export const SUBSCRIPTION_ROUTES: RouteObject[] = [
  { path: '/preturi', element: <PricingPage />, handle: pageTitle('Prețuri') },
]

export const CLUB_SUBSCRIPTION_ROUTES: RouteObject[] = [
  { path: '/club/abonament', element: <ClubSubscriptionPage /> },
]

export const COACH_SUBSCRIPTION_ROUTES: RouteObject[] = [
  { path: '/coach/abonament', element: <CoachSubscriptionPage /> },
]
