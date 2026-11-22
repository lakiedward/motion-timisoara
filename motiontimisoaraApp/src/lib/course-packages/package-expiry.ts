import { dateLabel } from './package-month'

export type ExpiringPackage = {
  sessions: number
  sessions_used: number
  valid_from: string
  valid_until: string
}

export function attendancePackageNote(
  packages: ExpiringPackage[] | null | undefined,
  remainingSessions: number,
  sessionDate: string,
): string | null {
  if (!packages?.length) return null
  const usable = packages
    .filter(
      (item) =>
        item.sessions_used < item.sessions &&
        item.valid_from <= sessionDate &&
        item.valid_until >= sessionDate,
    )
    .sort((a, b) => a.valid_until.localeCompare(b.valid_until))
  if (usable.length) return `expiră pe ${dateLabel(usable[0].valid_until)}`
  return remainingSessions > 0 ? null : 'fără pachet valabil'
}
