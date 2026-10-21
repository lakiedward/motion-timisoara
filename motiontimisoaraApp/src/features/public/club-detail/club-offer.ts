import type { TabaraDinLista } from '@/api/camps'
import type { ActivitateDinLista, CourseCatalogItem } from '@/api/public'

export type OfferKind = 'courses' | 'camps' | 'activities'

export type ClubOffer = {
  courses: CourseCatalogItem[]
  camps: TabaraDinLista[]
  activities: ActivitateDinLista[]
}

export const OFFER_LABELS: Record<OfferKind, string> = {
  courses: 'Cursuri',
  camps: 'Tabere',
  activities: 'Activități',
}

export const OFFER_KINDS: OfferKind[] = ['courses', 'camps', 'activities']

export const SEARCH_THRESHOLD = 6

function matches(text: string | null | undefined, search: string) {
  return (text ?? '').toLocaleLowerCase('ro').includes(search)
}

export function filterClubOffer(offer: ClubOffer, rawSearch: string): ClubOffer {
  const search = rawSearch.trim().toLocaleLowerCase('ro')
  if (!search) return offer
  return {
    courses: offer.courses.filter((c) => matches(c.name, search) || matches(c.sport?.name, search)),
    camps: offer.camps.filter((c) => matches(c.title, search)),
    activities: offer.activities.filter(
      (a) => matches(a.name, search) || matches(a.sportName, search),
    ),
  }
}

export function offerTotal(offer: ClubOffer) {
  return offer.courses.length + offer.camps.length + offer.activities.length
}
