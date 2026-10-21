import { useRef, useState, useSyncExternalStore } from 'react'
import { CloudUpload, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { scanAttendanceCode } from './native-scanner'
import { useAttendanceQueue } from './attendance-context'
import type { AttendanceQueue } from './attendance-queue'
import { GroupCounts, ScanRow, SyncStatus } from './ScanQueueParts'
import { groupScans, type ScanGroup } from './scan-queue'

function useQueueState(queue: AttendanceQueue) {
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  const pending = snapshot.entries.filter((entry) => entry.state === 'pending').length
  const rejected = snapshot.entries.filter((entry) => entry.state === 'rejected').length
  return { snapshot, pending, rejected }
}

function InlineGroups({ queue, groups }: { queue: AttendanceQueue; groups: ScanGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.occurrenceId} aria-label={group.label} className="border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display min-w-0 text-sm font-bold wrap-anywhere">{group.label}</h3>
            <GroupCounts group={group} />
          </div>
          <ul className="mt-2 divide-y">
            {group.entries.map((entry) => (
              <ScanRow key={entry.id} queue={queue} entry={entry} className="py-3" />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function ScannerControls({
  queue,
  occurrenceId,
  label,
}: {
  queue: AttendanceQueue
  occurrenceId: string
  label: string
}) {
  const { snapshot, pending, rejected } = useQueueState(queue)
  const [scanning, setScanning] = useState(false)
  const scanLock = useRef(false)
  const entries = snapshot.entries
    .filter((entry) => entry.occurrenceId === occurrenceId)
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
  const others = groupScans(
    snapshot.entries.filter((entry) => entry.occurrenceId !== occurrenceId),
  ).filter((group) => group.pending + group.rejected > 0)

  async function scan() {
    if (scanLock.current) return
    scanLock.current = true
    setScanning(true)
    try {
      const token = await scanAttendanceCode(label)
      if (token) await queue.enqueue(occurrenceId, label, token)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Codul nu a putut fi salvat. Reîncearcă.',
      )
    } finally {
      scanLock.current = false
      setScanning(false)
    }
  }

  return (
    <section
      aria-label="Scanare QR pentru prezență"
      className="bg-card space-y-3 rounded-xl border p-4"
    >
      <div>
        <h2 className="font-semibold">Scanează prezența</h2>
        <p className="text-muted-foreground mt-1 text-sm">{label}</p>
      </div>
      <Button className="w-full" disabled={scanning || !snapshot.ready} onClick={() => void scan()}>
        <ScanLine aria-hidden="true" /> {scanning ? 'Camera este deschisă…' : 'Scanează cod QR'}
      </Button>
      <p className="text-muted-foreground text-xs">
        Fără internet, codurile sunt păstrate pe telefon până la confirmarea serverului. Catalogul
        manual rămâne disponibil.
      </p>
      <SyncStatus queue={queue} snapshot={snapshot} pending={pending} rejected={rejected} />
      {entries.length > 0 && (
        <ul aria-label="Scanările ședinței" className="max-h-64 divide-y overflow-y-auto pr-2">
          {entries.map((entry) => (
            <ScanRow key={entry.id} queue={queue} entry={entry} className="py-3" />
          ))}
        </ul>
      )}
      {others.length > 0 && <InlineGroups queue={queue} groups={others} />}
    </section>
  )
}

export function AttendanceScanner(props: { occurrenceId: string; label: string }) {
  const queue = useAttendanceQueue()
  return queue ? <ScannerControls {...props} queue={queue} /> : null
}

function CardPerSessionQueue({ queue, groups }: { queue: AttendanceQueue; groups: ScanGroup[] }) {
  const { snapshot, pending, rejected } = useQueueState(queue)
  return (
    <section aria-label="Scanări de sincronizat" className="mb-4 space-y-2">
      <div className="bg-card flex gap-3 rounded-xl border p-4">
        <span className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-lg">
          <CloudUpload aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="font-semibold">Scanări de sincronizat</h2>
          <SyncStatus queue={queue} snapshot={snapshot} pending={pending} rejected={rejected} />
        </div>
      </div>
      {groups.map((group) => (
        <section
          key={group.occurrenceId}
          aria-label={group.label}
          className="bg-card overflow-hidden rounded-xl border"
        >
          <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <h3 className="text-foreground min-w-0 text-sm font-semibold wrap-anywhere">
              {group.label}
            </h3>
            <GroupCounts group={group} />
          </div>
          <ul className="divide-y">
            {group.entries.map((entry) => (
              <ScanRow key={entry.id} queue={queue} entry={entry} className="px-4 py-3" />
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

function OfflineQueue({ queue }: { queue: AttendanceQueue }) {
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  const groups = groupScans(snapshot.entries).filter((group) => group.pending + group.rejected > 0)
  if (!groups.length) return snapshot.error ? <p role="alert">{snapshot.error}</p> : null
  return <CardPerSessionQueue queue={queue} groups={groups} />
}

export function AttendanceOfflineQueue() {
  const queue = useAttendanceQueue()
  return queue ? <OfflineQueue queue={queue} /> : null
}
