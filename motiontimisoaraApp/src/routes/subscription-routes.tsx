import type { RouteObject } from 'react-router-dom'

import PricingPage from '@/features/public/pricing/PricingPage'

export const SUBSCRIPTION_ROUTES: RouteObject[] = [{ path: '/preturi', element: <PricingPage /> }]
