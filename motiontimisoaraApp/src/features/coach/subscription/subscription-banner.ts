import { subscriptionCopy } from '@/features/subscriptions/subscription-copy'
import type { SubscriptionView } from '@/features/subscriptions/subscription-state'

export const BANNER_TRIAL_WINDOW_DAYS = 14

export type BannerContent = { title: string; text: string; urgent: boolean }

export function daysLeftLabel(view: SubscriptionView): BannerContent | null {
  switch (view.kind) {
    case 'trialing':
      if (view.paid || view.daysLeft > BANNER_TRIAL_WINDOW_DAYS) return null
      return {
        title:
          view.daysLeft === 1
            ? 'Perioada gratuită se termină mâine'
            : `Perioada gratuită se termină în ${view.daysLeft} zile`,
        text: 'Alege abonamentul ca profilul și ofertele tale să rămână vizibile.',
        urgent: view.daysLeft <= 3,
      }
    case 'past_due':
      return {
        title: 'Plata abonamentului nu a trecut',
        text: subscriptionCopy(view, null).detail,
        urgent: true,
      }
    case 'expired':
      return {
        title: 'Abonamentul a expirat',
        text: 'Profilul și ofertele tale nu apar acum în căutare. Alege abonamentul ca să revii imediat.',
        urgent: true,
      }
    default:
      return null
  }
}
