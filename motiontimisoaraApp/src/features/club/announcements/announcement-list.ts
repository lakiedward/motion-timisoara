import type { ClubAnnouncement, ClubAudience } from '@/api/club'

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

export const formatData = (iso: string) => dateFormat.format(new Date(iso))

export function grupeazaPeLuni(items: ClubAnnouncement[]) {
  const grupe: { key: string; title: string; items: ClubAnnouncement[] }[] = []
  for (const a of items) {
    const raw = monthFormat.format(new Date(a.created_at))
    const title = raw.charAt(0).toLocaleUpperCase('ro-RO') + raw.slice(1)
    const grupa = grupe.find((g) => g.key === title)
    if (grupa) grupa.items.push(a)
    else grupe.push({ key: title, title, items: [a] })
  }
  return grupe
}
