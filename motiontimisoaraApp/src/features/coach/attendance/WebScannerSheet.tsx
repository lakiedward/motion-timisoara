import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusView } from '@/components/ui/status-view'
import {
  cameraProblemText,
  cameraSupported,
  classifyCameraError,
  startWebCamera,
  type CameraProblem,
  type CameraSession,
} from './web-camera'

let cameraMount = 0

function CameraView({
  onDetected,
  onRetry,
}: {
  onDetected: (text: string) => void
  onRetry: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [problem, setProblem] = useState<CameraProblem | null>(() =>
    cameraSupported() ? null : 'unsupported',
  )
  const [starting, setStarting] = useState(true)
  const detected = useRef(onDetected)
  useEffect(() => {
    detected.current = onDetected
  }, [onDetected])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !cameraSupported()) return
    const element = document.createElement('div')
    element.id = `qr-camera-${(cameraMount += 1)}`
    element.className = 'w-full'
    host.appendChild(element)
    let disposed = false
    let session: CameraSession | null = null
    let done = false
    let begun = false
    const handleText = (text: string) => {
      if (done || disposed) return
      done = true
      const current = session
      void (current ? current.stop() : Promise.resolve())
        .catch(() => undefined)
        .finally(() => detected.current(text))
    }
    const timer = window.setTimeout(() => {
      begun = true
      startWebCamera(element.id, handleText)
        .then((started) => {
          session = started
          if (disposed || done) {
            void started
              .stop()
              .catch(() => undefined)
              .finally(() => {
                if (disposed) element.remove()
              })
          } else setStarting(false)
        })
        .catch((error: unknown) => {
          if (!disposed) setProblem(classifyCameraError(error))
        })
    }, 0)
    return () => {
      disposed = true
      window.clearTimeout(timer)
      if (!begun) element.remove()
      if (!session) return
      void session
        .stop()
        .catch(() => undefined)
        .finally(() => element.remove())
    }
  }, [])

  if (problem) {
    const copy = cameraProblemText[problem]
    return (
      <StatusView
        state="error"
        title={copy.title}
        text={copy.text}
        onRetry={problem === 'unsupported' || problem === 'no-camera' ? undefined : onRetry}
        className="py-8"
      />
    )
  }
  return (
    <div className="relative mx-auto min-h-64 w-full max-w-sm overflow-hidden rounded-2xl bg-(--overlay-scrim)">
      <div ref={hostRef} data-testid="qr-camera" className="w-full" />
      <div
        aria-hidden="true"
        className="border-primary pointer-events-none absolute inset-[15%] rounded-2xl border-2"
      />
      {starting && (
        <p
          role="status"
          className="bg-(--overlay-scrim) text-white absolute inset-x-0 bottom-0 px-4 py-3 text-center text-sm"
        >
          Pornim camera…
        </p>
      )}
    </div>
  )
}

export function WebScannerSheet({
  open,
  label,
  onDetected,
  onClose,
}: {
  open: boolean
  label: string
  onDetected: (text: string) => void
  onClose: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-dvh gap-0 overflow-y-auto rounded-t-2xl sm:mx-auto sm:max-w-md"
      >
        <SheetHeader className="pr-14">
          <SheetTitle className="wrap-anywhere">{label}</SheetTitle>
          <SheetDescription>Încadrează codul QR al copilului</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          {open && (
            <CameraView
              key={attempt}
              onDetected={onDetected}
              onRetry={() => setAttempt((value) => value + 1)}
            />
          )}
        </div>
        <SheetFooter>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Anulează
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
