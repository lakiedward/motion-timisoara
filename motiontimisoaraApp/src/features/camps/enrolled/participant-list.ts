import type { CampParticipant } from '@/api/live-location/discovery'
import { varstaLa, type CopilInscris } from '@/api/camp-enrolled'
import { fold } from '@/features/admin/courses/course-overview'
import { TIPURI_ALERTA, areAlerta, type CheieAlerta } from './child-alerts'

export type AlertFilter = CheieAlerta | 'all'
export type ArrivalFilter = '' | 'pending' | 'arrived' | 'departed'

export type ParticipantFilters = { alert: AlertFilter; arrival: ArrivalFilter; query: string }

export const NO_PARTICIPANT_FILTERS: ParticipantFilters = { alert: 'all', arrival: '', query: '' }

export type AgeGroupKey = 'u8' | '8-10' | '11-13' | '14+' | 'unknown' | 'adult'

const AGE_GROUP_TITLES: Record<AgeGroupKey, string> = {
  u8: 'Sub 8 ani',
  '8-10': '8–10 ani',
  '11-13': '11–13 ani',
  '14+': '14 ani și peste',
  unknown: 'Vârstă necunoscută',
  adult: 'Adulți',
}

const AGE_GROUP_ORDER: AgeGroupKey[] = ['u8', '8-10', '11-13', '14+', 'unknown', 'adult']

export function hasParticipantFilters(f: ParticipantFilters) {
  return f.alert !== 'all' || f.arrival !== '' || f.query.trim() !== ''
}

export function participantAge(p: CopilInscris, campStart: string | null) {
  if (p.fel === 'adult' || !campStart) return null
  return varstaLa(p.dataNasterii, campStart)
}

export function ageGroup(p: CopilInscris, campStart: string | null): AgeGroupKey {
  if (p.fel === 'adult') return 'adult'
  const age = participantAge(p, campStart)
  if (age === null) return 'unknown'
  if (age < 8) return 'u8'
  if (age <= 10) return '8-10'
  if (age <= 13) return '11-13'
  return '14+'
}

export function arrivalState(participant: CampParticipant | null | undefined): ArrivalFilter {
  if (!participant) return ''
  if (participant.departedAt) return 'departed'
  if (participant.arrivedAt) return 'arrived'
  return 'pending'
}

export function matchesParticipantQuery(p: CopilInscris, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(
    [p.nume, p.contactUrgenta, p.contactSecundar, p.telefonUrgenta, p.telefonSecundar]
      .filter(Boolean)
      .join(' '),
  ).includes(needle)
}

export function alertCounts(list: CopilInscris[]): Record<AlertFilter, number> {
  const counts = { all: list.length } as Record<AlertFilter, number>
  for (const t of TIPURI_ALERTA) counts[t.cheie] = list.filter((p) => areAlerta(p, t.cheie)).length
  return counts
}

export function arrivalCounts(
  list: CopilInscris[],
  byEnrollment: Map<string, CampParticipant>,
): Record<Exclude<ArrivalFilter, ''>, number> {
  const counts = { pending: 0, arrived: 0, departed: 0 }
  for (const p of list) {
    const s = arrivalState(byEnrollment.get(p.enrollmentId))
    if (s) counts[s] += 1
  }
  return counts
}

export function filterParticipants(
  list: CopilInscris[],
  { alert, arrival, query }: ParticipantFilters,
  byEnrollment: Map<string, CampParticipant>,
) {
  return list.filter(
    (p) =>
      (alert === 'all' || areAlerta(p, alert)) &&
      (!arrival || arrivalState(byEnrollment.get(p.enrollmentId)) === arrival) &&
      matchesParticipantQuery(p, query),
  )
}

export function groupByAge(list: CopilInscris[], campStart: string | null) {
  const sorted = [...list].sort((a, b) => a.nume.localeCompare(b.nume, 'ro'))
  return AGE_GROUP_ORDER.map((key) => ({
    key,
    title: AGE_GROUP_TITLES[key],
    items: sorted.filter((p) => ageGroup(p, campStart) === key),
  })).filter((g) => g.items.length > 0)
}
