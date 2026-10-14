import * as React from 'react'
import { CircleAlert } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FieldControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

interface FieldProps {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  className?: string
  children: (control: FieldControlProps) => React.ReactNode
}

function Field({ id, label, hint, error, className, children }: FieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined
  return (
    <div data-slot="field" className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {error ? (
        <p id={errorId} className="text-destructive flex items-center gap-1.5 text-xs font-medium">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export { Field }
