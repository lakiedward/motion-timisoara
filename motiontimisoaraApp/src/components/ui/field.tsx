import * as React from 'react'
import { AlertCircle } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FieldControlProps = {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  'aria-required'?: true
}

type FieldProps = {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (control: FieldControlProps) => React.ReactNode
}

function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const messageId = `${id}-message`
  const hasMessage = Boolean(error || hint)
  return (
    <div data-slot="field" className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': hasMessage ? messageId : undefined,
        'aria-required': required ? true : undefined,
      })}
      {error ? (
        <p id={messageId} className="text-destructive flex items-center gap-1.5 text-xs font-medium">
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export { Field, type FieldControlProps }
