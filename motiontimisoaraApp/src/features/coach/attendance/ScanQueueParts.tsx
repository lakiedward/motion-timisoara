import { Check, Clock, CloudOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import type { AttendanceQueue, ScanEntry } from './attendance-queue'

type Snapshot = ReturnType<AttendanceQueue['getSnapshot']>

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
  const date = new Date(iso)
  const time = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `la ${time}`
  const day = date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })
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

export function ScanStateBadge({ state }: { state: ScanEntry['state'] }) {
  if (state === 'confirmed')
    return (
      <Badge variant="success">
        <Check aria-hidden="true" />
        Confirmat
      </Badge>
    )
  if (state === 'rejected') return <Badge variant="destructive">Respins</Badge>
  return (
    <Badge variant="outline">
      <Clock aria-hidden="true" />
      În așteptare
    </Badge>
  )
}

export function GroupCounts({ group }: { group: ScanGroup }) {
  return (
    <span className="flex flex-wrap gap-1">
      {group.pending > 0 && <Badge variant="outline">{group.pending} în așteptare</Badge>}
      {group.rejected > 0 && <Badge variant="destructive">{group.rejected} de verificat</Badge>}
    </span>
  )
}

export function ScanRow({
  queue,
  entry,
  className,
}: {
  queue: AttendanceQueue
  entry: ScanEntry
  className?: string
}) {
  return (
    <li className={cn('space-y-1 text-sm', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ScanStateBadge state={entry.state} />
        <span className="text-muted-foreground text-xs tabular-nums">
          Scanat {formatScanTime(entry.capturedAt)}
        </span>
      </div>
      {entry.state !== 'pending' && <p className="text-foreground">{entry.message}</p>}
      {entry.state !== 'pending' && (
        <Button
          variant="ghost"
          className="-ml-3 px-3"
          onClick={() =>
            void queue.dismiss(entry.id).catch(() => toast.error('Nu am putut actualiza lista.'))
          }
        >
          Ascunde rezultatul
        </Button>
      )}
    </li>
  )
}

export function SyncStatus({
  queue,
  snapshot,
  pending,
  rejected,
}: {
  queue: AttendanceQueue
  snapshot: Snapshot
  pending: number
  rejected: number
}) {
  const counts = scanCounts(pending, rejected)
  return (
    <div className="space-y-2">
      <div role="status" aria-live="polite" className="space-y-1 text-sm">
        {snapshot.syncing ? (
          <p>Se sincronizează…</p>
        ) : (
          counts.length > 0 && <p className="font-medium">{counts.join(' · ')}</p>
        )}
        {snapshot.waiting && pending > 0 && !snapshot.syncing && (
          <p className="text-muted-foreground flex gap-2">
            <CloudOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {waitingText(pending)}
          </p>
        )}
        {snapshot.syncedAt && (
          <p className="text-muted-foreground text-xs">
            Ultima sincronizare {formatScanTime(snapshot.syncedAt)}
          </p>
        )}
      </div>
      {snapshot.error && (
        <p role="alert" className="text-destructive text-sm">
          {snapshot.error}
        </p>
      )}
      {(pending > 0 || snapshot.error) && (
        <Button variant="outline" disabled={snapshot.syncing} onClick={() => void queue.retry()}>
          <RefreshCw aria-hidden="true" /> Reîncearcă sincronizarea
        </Button>
      )}
    </div>
  )
}
