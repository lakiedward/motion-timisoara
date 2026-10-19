import type { AnnouncementRow } from '@/api/announcements/parent'

const TZ = 'Europe/Bucharest'
const dateFormat = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
})
const monthFormat = new Intl.DateTimeFormat('ro-RO', {
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
})

export function publishedDate(item: AnnouncementRow) {
  return dateFormat.format(new Date(item.publishedAt))
}

export function isNew(item: AnnouncementRow, previousSeenAt: string | null) {
  return !previousSeenAt || Date.parse(item.publishedAt) > Date.parse(previousSeenAt)
}

export function sourceLabel(item: AnnouncementRow) {
  return item.source === 'club' ? 'Anunț de club' : 'Anunț de la antrenor'
}

export function audienceText(item: AnnouncementRow) {
  if (item.audienceKind === 'CLUB') return 'Pentru toți părinții clubului'
  const prefix =
    item.audienceKind === 'CAMP'
      ? 'Tabără: '
      : item.audienceKind === 'ACTIVITY'
        ? 'Activitate: '
        : ''
  return `${prefix}${item.audienceName ?? 'Destinație indisponibilă'}`
}

export function courseLabel(item: AnnouncementRow) {
  return item.courseName ?? item.audienceName ?? 'Vezi cursul'
}

export function groupByMonth(items: AnnouncementRow[]) {
  const groups: { key: string; title: string; items: AnnouncementRow[] }[] = []
  for (const item of items) {
    const raw = item.pinned ? 'Fixate' : monthFormat.format(new Date(item.publishedAt))
    const title = raw.charAt(0).toLocaleUpperCase('ro-RO') + raw.slice(1)
    const group = groups.find((existing) => existing.key === title)
    if (group) group.items.push(item)
    else groups.push({ key: title, title, items: [item] })
  }
  return groups
}
