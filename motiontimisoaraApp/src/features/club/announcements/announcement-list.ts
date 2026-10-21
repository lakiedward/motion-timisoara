import type { ClubAnnouncement, ClubAudience } from '@/api/club'
import { scheduleState, type ScheduleState } from './announcement-schedule'

export type PriorityStyle = {
  label: string
  variant: 'secondary' | 'default' | 'highlight' | 'destructive'
}

export const PRIORITY: Record<string, PriorityStyle> = {
  LOW: { label: 'Scăzută', variant: 'secondary' },
  NORMAL: { label: 'Normală', variant: 'default' },
  HIGH: { label: 'Ridicată', variant: 'highlight' },
  URGENT: { label: 'Urgentă', variant: 'destructive' },
}

export const priorityOf = (a: ClubAnnouncement) => PRIORITY[a.priority] ?? PRIORITY.NORMAL

export const ETICHETA_TINTA: Record<string, string> = {
  COURSE: 'Curs',
  ACTIVITY: 'Activitate',
  CAMP: 'Tabără',
}

const INDISPONIBIL: Record<string, string> = {
  COURSE: 'Curs indisponibil',
  ACTIVITY: 'Activitate indisponibilă',
  CAMP: 'Tabără indisponibilă',
}

export function numeleTintei(
  a: ClubAnnouncement,
  tinte: ClubAudience[],
  tinteNecunoscute: boolean,
): string {
  if (a.audience_kind === 'CLUB') return 'Toți părinții clubului'
  const fel = ETICHETA_TINTA[a.audience_kind] ?? a.audience_kind
  const gasita = tinte.find((t) => t.kind === a.audience_kind && t.id === a.audience_id)
  if (gasita) return `${fel}: ${gasita.name}`
  if (tinteNecunoscute) return `${fel} — nu am putut încărca numele`
  return INDISPONIBIL[a.audience_kind] ?? `${fel} indisponibil`
}

const dateFormat = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Bucharest',
})

export const formatData = (iso: string) => dateFormat.format(new Date(iso))

const GRUPE: { key: ScheduleState; title: string }[] = [
  { key: 'scheduled', title: 'Programate' },
  { key: 'live', title: 'Vizibile acum' },
  { key: 'expired', title: 'Expirate' },
]

const momentPublicarii = (a: ClubAnnouncement) => new Date(a.publish_at ?? a.created_at).getTime()

export function grupeazaPeStare(items: ClubAnnouncement[], acum = new Date()) {
  return GRUPE.map(({ key, title }) => {
    const din = items.filter((a) => scheduleState(a, acum) === key)
    if (key === 'scheduled') din.sort((x, y) => momentPublicarii(x) - momentPublicarii(y))
    return { key, title, items: din }
  }).filter((g) => g.items.length > 0)
}
