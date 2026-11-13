import { useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { tokenDinCod } from '@/lib/cod-qr'
import { isNative } from '@/lib/platform'
import { scanAttendanceCode } from '../native-scanner'
import { WebScannerSheet } from '../WebScannerSheet'
import type { AttendanceQueue } from '../attendance-queue'

export function useQueueState(queue: AttendanceQueue) {
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  const pending = snapshot.entries.filter((entry) => entry.state === 'pending').length
  const rejected = snapshot.entries.filter((entry) => entry.state === 'rejected').length
  return { snapshot, pending, rejected }
}

function saveError(error: unknown) {
  toast.error(error instanceof Error ? error.message : 'Codul nu a putut fi salvat. Reîncearcă.')
}

export function useSessionScan(queue: AttendanceQueue, occurrenceId: string, label: string) {
  const [scanning, setScanning] = useState(false)
  const [webOpen, setWebOpen] = useState(false)
  const scanLock = useRef(false)
  const native = isNative()

  async function saveWebCode(text: string) {
    setWebOpen(false)
    const token = tokenDinCod(text)
    if (!token) {
      toast.error('Acesta nu este un cod QR Motion valid. Cere codul copilului.')
      return
    }
    try {
      await queue.enqueue(occurrenceId, label, token)
    } catch (error) {
      saveError(error)
    }
  }

  async function scan() {
    if (!native) {
      setWebOpen(true)
      return
    }
    if (scanLock.current) return
    scanLock.current = true
    setScanning(true)
    try {
      const token = await scanAttendanceCode(label)
      if (token) await queue.enqueue(occurrenceId, label, token)
    } catch (error) {
      saveError(error)
    } finally {
      scanLock.current = false
      setScanning(false)
    }
  }

  const sheet = native ? null : (
    <WebScannerSheet
      open={webOpen}
      label={label}
      onDetected={(text) => void saveWebCode(text)}
      onClose={() => setWebOpen(false)}
    />
  )

  return { scan: () => void scan(), cameraOpen: scanning || webOpen, native, sheet }
}
