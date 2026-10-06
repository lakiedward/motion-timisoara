import { Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { copyInviteValue } from './copyInviteValue'

export default function CopyInviteValueButton({
  value,
  label,
  successMessage,
}: {
  value: string
  label: string
  successMessage: string
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="min-h-11 min-w-11"
      aria-label={label}
      onClick={() => void copyInviteValue(value, successMessage)}
    >
      <Copy />
    </Button>
  )
}
