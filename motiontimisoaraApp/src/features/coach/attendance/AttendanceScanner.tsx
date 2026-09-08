import { useRef, useState, useSyncExternalStore } from 'react'
import { ScanLine, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { scanAttendanceCode } from './native-scanner'
import { useAttendanceQueue } from './attendance-context'
import type { AttendanceQueue } from './attendance-queue'

function DismissScan({ queue, id }: { queue: AttendanceQueue; id: string }) {
  return (
    <Button
      variant="ghost"
      className="mt-1 min-h-11"
      onClick={() =>
        void queue.dismiss(id).catch(() => toast.error('Nu am putut actualiza lista.'))
      }
    >
      Ascunde rezultatul
    </Button>
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
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  const [scanning, setScanning] = useState(false)
  const scanLock = useRef(false)
  const pending = snapshot.entries.filter((entry) => entry.state === 'pending').length
  const rejected = snapshot.entries.filter((entry) => entry.state === 'rejected').length
  const entries = snapshot.entries.filter((entry) => entry.occurrenceId === occurrenceId)

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
      className="bg-card mb-3 space-y-3 rounded-3xl border p-4"
    >
      <div>
        <h2 className="font-semibold">Scanează prezența</h2>
        <p className="text-muted-foreground mt-1 text-sm">{label}</p>
      </div>
      <Button
        className="min-h-11 w-full"
        disabled={scanning || !snapshot.ready}
        onClick={() => void scan()}
      >
        <ScanLine aria-hidden="true" /> {scanning ? 'Camera este deschisă…' : 'Scanează cod QR'}
      </Button>
      <p className="text-muted-foreground text-xs">
        Fără internet, codurile sunt păstrate pe telefon până la confirmarea serverului. Catalogul
        manual rămâne disponibil.
      </p>
      <div role="status" aria-live="polite" className="text-sm">
        {snapshot.syncing
          ? 'Se sincronizează…'
          : `${pending} în așteptare · ${rejected} de verificat`}
      </div>
      {snapshot.error && (
        <p role="alert" className="text-destructive text-sm">
          {snapshot.error}
        </p>
      )}
      {(pending > 0 || snapshot.error) && (
        <Button
          variant="outline"
          className="min-h-11"
          disabled={snapshot.syncing}
          onClick={() => void queue.retry()}
        >
          <RefreshCw aria-hidden="true" /> Reîncearcă sincronizarea
        </Button>
      )}
      {entries.length > 0 && (
        <ul aria-label="Scanările ședinței" className="max-h-64 space-y-3 overflow-y-auto pr-2">
          {[...entries].reverse().map((entry) => (
            <li key={entry.id} className="border-t pt-3 text-sm">
              <p className={entry.state === 'rejected' ? 'text-destructive' : ''}>
                {entry.message}
              </p>
              <p className="text-muted-foreground text-xs">
                Scanat la{' '}
                {new Date(entry.capturedAt).toLocaleTimeString('ro-RO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {entry.state !== 'pending' && <DismissScan queue={queue} id={entry.id} />}
            </li>
          ))}
        </ul>
      )}
      {snapshot.entries.some(
        (entry) => entry.occurrenceId !== occurrenceId && entry.state !== 'confirmed',
      ) && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-3">Scanări din alte ședințe</summary>
          <ul className="space-y-3">
            {snapshot.entries
              .filter((entry) => entry.occurrenceId !== occurrenceId && entry.state !== 'confirmed')
              .map((entry) => (
                <li key={entry.id}>
                  <p className="font-medium">{entry.label}</p>
                  <p>{entry.message}</p>
                  {entry.state === 'rejected' && <DismissScan queue={queue} id={entry.id} />}
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  )
}

export function AttendanceScanner(props: { occurrenceId: string; label: string }) {
  const queue = useAttendanceQueue()
  return queue ? <ScannerControls {...props} queue={queue} /> : null
}

function OfflineQueue({ queue }: { queue: AttendanceQueue }) {
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  const entry = snapshot.entries.find((row) => row.state !== 'confirmed')
  if (!entry) return snapshot.error ? <p role="alert">{snapshot.error}</p> : null
  return <ScannerControls queue={queue} occurrenceId={entry.occurrenceId} label={entry.label} />
}

export function AttendanceOfflineQueue() {
  const queue = useAttendanceQueue()
  return queue ? <OfflineQueue queue={queue} /> : null
}
