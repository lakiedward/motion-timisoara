import { dayKey, formatTime } from '@/features/admin/attendance/attendance-overview'
import { plural } from '@/lib/plural'
import type { ScanEntry } from './attendance-queue'

export type ScanGroup = {
  occurrenceId: string
  label: string
  entries: ScanEntry[]
  pending: number
  rejected: number
}

export function groupScans(entries: ScanEntry[]): ScanGroup[] {
  const groups = new Map<string, ScanGroup>()
  for (const entry of entries) {
    const group = groups.get(entry.occurrenceId) ?? {
      occurrenceId: entry.occurrenceId,
      label: entry.label,
      entries: [],
      pending: 0,
      rejected: 0,
    }
    group.entries.push(entry)
    if (entry.state === 'pending') group.pending += 1
    if (entry.state === 'rejected') group.rejected += 1
    groups.set(entry.occurrenceId, group)
  }
  const latest = (group: ScanGroup) =>
    Math.max(...group.entries.map((entry) => Date.parse(entry.capturedAt)))
  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort(
        (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
      ),
    }))
    .sort((a, b) => Number(b.pending > 0) - Number(a.pending > 0) || latest(b) - latest(a))
}

export function formatScanTime(iso: string, now = new Date()) {
  const time = formatTime(iso)
  if (dayKey(iso) === dayKey(now.getTime())) return `la ${time}`
  const day = new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
  return `pe ${day} la ${time}`
}

export function scanCounts(pending: number, rejected: number) {
  return [
    pending > 0 ? `${pending} în așteptare` : null,
    rejected > 0 ? `${rejected} de verificat` : null,
  ].filter((part): part is string => part !== null)
}

export function waitingText(pending: number) {
  return pending === 1
    ? 'Fără conexiune. 1 scanare este păstrată pe telefon și se trimite singură când revine internetul.'
    : `Fără conexiune. ${plural(pending, 'scanare', 'scanări')} sunt păstrate pe telefon și se trimit singure când revine internetul.`
}
