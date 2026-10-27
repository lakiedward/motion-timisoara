import type { ActivitateDetaliu } from '@/api/public'

type ActivityLocation = NonNullable<ActivitateDetaliu['location']>

export function activityDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString('ro-RO')
}

export function activityHours(activity: Pick<ActivitateDetaliu, 'startTime' | 'endTime'>): string {
  return `${activity.startTime.slice(0, 5)}–${activity.endTime.slice(0, 5)}`
}

export function activityMapLink(location: ActivityLocation): string | undefined {
  return location.lat != null && location.lng != null
    ? `/harta?location=${encodeURIComponent(location.id)}`
    : undefined
}
