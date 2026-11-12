import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanLine } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { WebScannerSheet } from '@/features/coach/attendance/WebScannerSheet'
import { entrancePath, readScannedEntrance } from '@/lib/entrance-code'
import { isNative } from '@/lib/platform'
import { cn } from '@/lib/utils'

export function EntranceScanButton({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (isNative()) return null

  const handle = (text: string) => {
    setOpen(false)
    const scanned = readScannedEntrance(text)
    if (scanned.kind === 'entrance') {
      navigate(entrancePath(scanned.token))
      return
    }
    toast.error(
      scanned.kind === 'child'
        ? 'Acesta e codul QR al unui copil. Scanează foaia lipită la intrare.'
        : 'Codul nu e de la intrarea Motion. Scanează foaia lipită la intrare.',
    )
  }

  return (
    <>
      <Button
        type="button"
        className={cn('h-touch-target min-h-touch-target', className)}
        disabled={open}
        onClick={() => setOpen(true)}
      >
        <ScanLine aria-hidden="true" /> Scanează codul de la intrare
      </Button>
      <WebScannerSheet
        open={open}
        label="Codul de la intrare"
        hint="Încadrează codul de pe foaia lipită la intrare"
        onDetected={handle}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
