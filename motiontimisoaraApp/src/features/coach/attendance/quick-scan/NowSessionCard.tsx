import { Link } from 'react-router-dom'
import { ClipboardList, ScanLine } from 'lucide-react'
import type { AdminSession } from '@/api/attendance/admin-sessions'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/features/admin/attendance/attendance-overview'
import { useSessionStarted } from '@/features/admin/attendance/use-session-started'
import { useAttendanceQueue } from '../attendance-context'
import type { AttendanceQueue } from '../attendance-queue'
import { sessionWhen } from '../coach-session-list'
import { ScanRow, SyncStatus } from '../ScanQueueParts'
import { useQueueState, useSessionScan } from './use-session-scan'

type CatalogAction =
  | { catalogTo: string; onCatalog?: never }
  | { onCatalog: () => void; catalogTo?: never }

function Card({
  queue,
  session,
  ...catalog
}: { queue: AttendanceQueue; session: AdminSession } & CatalogAction) {
  const label = `${session.courseName} · ${sessionWhen(session)}`
  const started = useSessionStarted(session.startsAt)
  const { snapshot, pending, rejected } = useQueueState(queue)
  const { scan, cameraOpen, sheet } = useSessionScan(queue, session.id, label)
  const entries = snapshot.entries
    .filter((entry) => entry.occurrenceId === session.id)
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
  const catalogContent = (
    <>
      <ClipboardList aria-hidden="true" /> Catalogul
    </>
  )

  return (
    <section aria-label="Ședința de acum" className="bg-card mb-6 space-y-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
            <ScanLine aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">Ședința de acum · {formatTime(session.startsAt)}</h2>
            <p className="text-muted-foreground text-sm wrap-anywhere">
              {session.courseName}
              {session.locationName ? ` · ${session.locationName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {catalog.catalogTo ? (
            <Button asChild variant="outline" className="bg-background w-full sm:w-auto">
              <Link to={catalog.catalogTo}>{catalogContent}</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="bg-background w-full sm:w-auto"
              onClick={catalog.onCatalog}
            >
              {catalogContent}
            </Button>
          )}
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={cameraOpen || !started || !snapshot.ready}
            onClick={scan}
          >
            <ScanLine aria-hidden="true" />{' '}
            {cameraOpen ? 'Camera este deschisă…' : 'Scanează cod QR'}
          </Button>
        </div>
      </div>
      {!started && (
        <p className="text-muted-foreground text-sm">
          Scanarea se deschide la {formatTime(session.startsAt)}.
        </p>
      )}
      {sheet}
      {(entries.length > 0 || snapshot.syncing || snapshot.error) && (
        <SyncStatus queue={queue} snapshot={snapshot} pending={pending} rejected={rejected} />
      )}
      {entries.length > 0 && (
        <ul
          aria-label="Scanările ședinței"
          className="max-h-64 divide-y overflow-y-auto border-t pr-2"
        >
          {entries.map((entry) => (
            <ScanRow key={entry.id} queue={queue} entry={entry} className="py-3" />
          ))}
        </ul>
      )}
    </section>
  )
}

export function NowSessionCard(props: { session: AdminSession } & CatalogAction) {
  const queue = useAttendanceQueue()
  return queue ? <Card {...props} queue={queue} /> : null
}
