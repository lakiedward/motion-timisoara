import { Check, Clock, CloudOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AttendanceQueue, ScanEntry } from './attendance-queue'
import { formatScanTime, scanCounts, waitingText, type ScanGroup } from './scan-queue'

type Snapshot = ReturnType<AttendanceQueue['getSnapshot']>

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
