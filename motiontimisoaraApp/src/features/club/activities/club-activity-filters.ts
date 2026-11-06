import type { ClubActivity } from '@/api/club'
import {
  NO_COACH_ACTIVITY_FILTERS,
  filterCoachActivities,
  hasCoachActivityFilters,
  type CoachActivityFilters,
} from '@/features/coach/activities/coach-activity-overview'

export type ClubActivityFilters = CoachActivityFilters & { coach: string }

export const NO_CLUB_ACTIVITY_FILTERS: ClubActivityFilters = {
  ...NO_COACH_ACTIVITY_FILTERS,
  coach: '',
}

export const CLEARED_CLUB_ACTIVITY_FILTERS: ClubActivityFilters = {
  ...NO_CLUB_ACTIVITY_FILTERS,
  status: 'all',
}

const searchText = (a: ClubActivity) =>
  `${a.name} ${a.location?.name ?? ''} ${a.coach?.name ?? ''}`

export function filterClubActivities(
  activities: ClubActivity[],
  filters: ClubActivityFilters,
  today: string,
) {
  return filterCoachActivities(
    filters.coach ? activities.filter((a) => a.coach?.id === filters.coach) : activities,
    filters,
    today,
    searchText,
  )
}

export function hasClubActivityFilters(filters: ClubActivityFilters) {
  return hasCoachActivityFilters(filters) || filters.coach !== ''
}

export function clubActivityCoachCounts(activities: ClubActivity[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const a of activities) {
    if (!a.coach) continue
    const entry = counts.get(a.coach.id) ?? {
      id: a.coach.id,
      name: a.coach.name?.trim() || '—',
      count: 0,
    }
    entry.count += 1
    counts.set(a.coach.id, entry)
  }
  return [...counts.values()].sort((x, y) => x.name.localeCompare(y.name, 'ro'))
}
