import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { copyInviteValue } from './copyInviteValue'

export default function CopyInviteValueButton({
  value,
  label,
  successMessage,
  autoCopy = false,
}: {
  value: string
  label: string
  successMessage: string
  autoCopy?: boolean
}) {
  const pending = useRef(autoCopy)
  const copyAttempt = useRef(0)
  const automaticCopy = useRef<Promise<boolean> | null>(null)
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    autoCopy ? 'pending' : 'idle',
  )
  useEffect(
    () => () => {
      copyAttempt.current += 1
    },
    [],
  )
  useEffect(() => {
    if (status !== 'success') return
    const dismissal = setTimeout(() => setStatus('idle'), 5000)
    return () => clearTimeout(dismissal)
  }, [status])
  useEffect(() => {
    if (!autoCopy) return
    let active = true
    automaticCopy.current ??= copyInviteValue(value)
    void automaticCopy.current.then((copied) => {
      if (!active) return
      pending.current = false
      setStatus(copied ? 'success' : 'error')
    })
    return () => {
      active = false
    }
  }, [autoCopy, value])
  const onCopy = async () => {
    if (pending.current) return
    pending.current = true
    const attempt = ++copyAttempt.current
    setStatus('pending')
    const copied = await copyInviteValue(value)
    if (attempt !== copyAttempt.current) return
    pending.current = false
    setStatus(copied ? 'success' : 'error')
  }
  return (
    <div className="min-w-0 space-y-1">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        aria-label={label}
        disabled={status === 'pending'}
        onClick={() => void onCopy()}
      >
        <Copy /> {status === 'pending' ? 'Se copiază…' : 'Copiază'}
      </Button>
      {status === 'success' && (
        <p role="status" className="text-muted-foreground text-xs">
          {successMessage}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-destructive text-xs">
          Nu am putut copia. Valoarea rămâne disponibilă pentru copiere manuală.
        </p>
      )}
    </div>
  )
}
