import { formatShortDate } from '@/lib/panel-date'
import type { SubscriptionView } from './subscription-state'

export type SubscriptionTone = 'success' | 'secondary' | 'destructive' | 'outline'

export type SubscriptionCopy = {
  badge: string
  tone: SubscriptionTone
  title: string
  detail: string
}

export type PlanLabel = { name: string; priceLei: string }

function dateOr(value: string | null, fallback: string): string {
  return value ? formatShortDate(value) : fallback
}

const CHARGE_NOW_WINDOW_MS = 48 * 3_600_000

function trialPaymentLine(endsAt: string, now: number): string {
  return Date.parse(endsAt) - now < CHARGE_NOW_WINDOW_MS
    ? 'Plata se face acum, la alegerea pachetului.'
    : 'Plătești abia la finalul perioadei gratuite.'
}

function launchPeriod(days: number): string {
  return days % 30 === 0 ? `${days / 30} luni` : `${days} de zile`
}

export function subscriptionCopy(
  view: SubscriptionView,
  plan: PlanLabel | null,
  now: number = Date.now(),
): SubscriptionCopy {
  const planLine = plan ? `${plan.name} · ${plan.priceLei} lei / lună` : 'Abonament'
  switch (view.kind) {
    case 'missing':
      return {
        badge: 'În pregătire',
        tone: 'outline',
        title: 'Abonamentul nu este încă pregătit',
        detail: 'Revino în câteva minute. Dacă mesajul rămâne, scrie-ne din pagina Contact.',
      }
    case 'launch_pending':
      return {
        badge: 'Gratuit',
        tone: 'success',
        title: 'Perioada gratuită de lansare',
        detail: `Ai ${launchPeriod(view.launchTrialDays)} gratuite, numărate de la lansarea abonamentelor. Vei putea alege pachetul după lansare; până atunci nu ai nimic de plătit.`,
      }
    case 'trialing':
      return view.paid
        ? {
            badge: 'Perioadă gratuită',
            tone: 'success',
            title: `${planLine}`,
            detail: `Ai ales pachetul. Prima plată este pe ${formatShortDate(view.endsAt)}, la finalul perioadei gratuite.`,
          }
        : {
            badge: 'Perioadă gratuită',
            tone: 'success',
            title:
              view.daysLeft === 1
                ? 'Mai ai o zi gratuită'
                : `Mai ai ${view.daysLeft} zile gratuite`,
            detail: `Până pe ${formatShortDate(view.endsAt)}. Alege un pachet înainte, ca profilul să rămână vizibil. ${trialPaymentLine(view.endsAt, now)}`,
          }
    case 'active':
      return {
        badge: 'Activ',
        tone: 'success',
        title: planLine,
        detail: `Următoarea plată: ${dateOr(view.nextChargeAt, 'în curând')}.`,
      }
    case 'past_due':
      return {
        badge: 'Plată eșuată',
        tone: 'destructive',
        title: 'Plata lunară nu a trecut',
        detail: `Reîncercăm plata. Profilul rămâne vizibil până pe ${dateOr(view.graceEndsAt, 'câteva zile')}. Actualizează cardul din „Gestionează abonamentul”.`,
      }
    case 'canceled':
      return {
        badge: 'Anulat',
        tone: 'outline',
        title: planLine,
        detail: `Abonamentul nu se mai reînnoiește și rămâne activ până pe ${dateOr(view.endsAt, 'finalul lunii plătite')}. Îl poți reactiva din „Gestionează abonamentul”.`,
      }
    case 'expired':
      return {
        badge: 'Expirat',
        tone: 'destructive',
        title: 'Abonamentul a expirat',
        detail:
          'Profilul și ofertele nu apar acum în căutare. Înscrierile existente continuă. Alege un pachet ca să revii imediat.',
      }
  }
}
