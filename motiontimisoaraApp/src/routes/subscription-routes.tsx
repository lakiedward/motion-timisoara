import type { RouteObject } from 'react-router-dom'

import AdminSubscriptionsPage from '@/features/admin/subscriptions/AdminSubscriptionsPage'
import ClubSubscriptionPage from '@/features/club/subscription/ClubSubscriptionPage'
import CoachSubscriptionPage from '@/features/coach/subscription/CoachSubscriptionPage'
import PricingPage from '@/features/public/pricing/PricingPage'

export const SUBSCRIPTION_ROUTES: RouteObject[] = [{ path: '/preturi', element: <PricingPage /> }]

export const CLUB_SUBSCRIPTION_ROUTES: RouteObject[] = [
  { path: '/club/abonament', element: <ClubSubscriptionPage /> },
]

export const COACH_SUBSCRIPTION_ROUTES: RouteObject[] = [
  { path: '/coach/abonament', element: <CoachSubscriptionPage /> },
]

export const ADMIN_SUBSCRIPTION_ROUTES: RouteObject[] = [
  { path: '/admin/subscriptions', element: <AdminSubscriptionsPage /> },
]
