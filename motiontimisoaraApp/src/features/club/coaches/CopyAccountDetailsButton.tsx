import { useEffect, useRef, useState } from 'react'
import { ClipboardCopy } from 'lucide-react'

import { copyInviteValue } from '@/components/invite-codes/copyInviteValue'
import { Button } from '@/components/ui/button'

export default function CopyAccountDetailsButton({ value }: { value: string }) {
  const pending = useRef(false)
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  useEffect(() => {
    if (status !== 'success') return
    const dismissal = setTimeout(() => setStatus('idle'), 5000)
    return () => clearTimeout(dismissal)
  }, [status])
  const onCopy = async () => {
    if (pending.current) return
    pending.current = true
    setStatus('pending')
    const copied = await copyInviteValue(value)
    pending.current = false
    setStatus(copied ? 'success' : 'error')
  }
  return (
    <div className="min-w-0 space-y-1">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={status === 'pending'}
        onClick={() => void onCopy()}
      >
        <ClipboardCopy /> {status === 'pending' ? 'Se copiază…' : 'Copiază datele de cont'}
      </Button>
      {status === 'success' && (
        <p role="status" className="text-muted-foreground text-xs">
          Emailul și parola temporară au fost copiate.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-destructive text-xs">
          Nu am putut copia. Datele rămân afișate pentru copiere manuală.
        </p>
      )}
    </div>
  )
}
