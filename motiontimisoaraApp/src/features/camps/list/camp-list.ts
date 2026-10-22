import type { InvitatieDeRaspuns } from '@/api/camp-coaches'
import type { TabaraDinLista } from '@/api/camps-admin'
import { sAIncheiat } from '@/api/camps'
import { fold } from '@/features/admin/courses/course-overview'
import { formatMoney, rezumatPretPeVarsta } from '@/lib/money'

export type CampStatus = 'ongoing' | 'upcoming' | 'ended'
export type CampStatusFilter = CampStatus | 'all'

export type CampFilters = { status: CampStatusFilter; query: string }

export const NO_FILTERS: CampFilters = { status: 'all', query: '' }

const STATUS_ORDER: CampStatus[] = ['ongoing', 'upcoming', 'ended']

export const STATUS_TITLES: Record<CampStatus, string> = {
  ongoing: 'În desfășurare',
  upcoming: 'Viitoare',
  ended: 'Încheiate',
}

function localDay(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function campStatus(
  camp: Pick<TabaraDinLista, 'period_start' | 'period_end'>,
  today = new Date(),
): CampStatus {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (sAIncheiat(camp.period_end, today)) return 'ended'
  if (localDay(camp.period_start).getTime() <= day) return 'ongoing'
  return 'upcoming'
}

export function matchesQuery(camp: TabaraDinLista, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${camp.title} ${camp.location_text ?? ''}`).includes(needle)
}

export function statusCounts(
  camps: TabaraDinLista[],
  today = new Date(),
): Record<CampStatusFilter, number> {
  const counts = { ongoing: 0, upcoming: 0, ended: 0, all: camps.length }
  for (const c of camps) counts[campStatus(c, today)] += 1
  return counts
}

export function filterCamps(
  camps: TabaraDinLista[],
  { status, query }: CampFilters,
  today = new Date(),
) {
  return camps.filter(
    (c) => (status === 'all' || campStatus(c, today) === status) && matchesQuery(c, query),
  )
}

export function hasFilters({ status, query }: CampFilters) {
  return status !== 'all' || query.trim() !== ''
}

export function groupByStatus(camps: TabaraDinLista[], today = new Date()) {
  const byStart = (a: TabaraDinLista, b: TabaraDinLista) =>
    a.period_start.localeCompare(b.period_start)
  return STATUS_ORDER.map((status) => {
    const items = camps.filter((c) => campStatus(c, today) === status).sort(byStart)
    return {
      status,
      title: STATUS_TITLES[status],
      items: status === 'ended' ? items.reverse() : items,
    }
  }).filter((g) => g.items.length)
}

export function campPrice(t: TabaraDinLista) {
  return t.pricing_mode === 'by_age'
    ? rezumatPretPeVarsta(t.preturiPeVarsta, t.currency)
    : formatMoney(t.price, t.currency)
}

export function pendingInvitations(invitations: InvitatieDeRaspuns[], today = new Date()) {
  return invitations
    .filter((i) => i.stare === 'invited' && !sAIncheiat(i.perioadaEnd, today))
    .sort((a, b) => a.perioadaStart.localeCompare(b.perioadaStart))
}

export function acceptedInvitations(invitations: InvitatieDeRaspuns[]) {
  return invitations.filter((i) => i.stare === 'accepted')
}
