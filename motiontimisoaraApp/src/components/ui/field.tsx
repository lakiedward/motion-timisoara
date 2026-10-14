import * as React from 'react'
import { CircleAlert } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps extends React.ComponentProps<'input'> {
  id: string
  label: string
  hint?: string
  error?: string
}

function FieldMessage({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-destructive flex items-center gap-1.5 text-xs font-medium">
        <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    )
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        {hint}
      </p>
    )
  }
  return null
}

function fieldDescription(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`
  return hint ? `${id}-hint` : undefined
}

function Field({ id, label, hint, error, className, ...props }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={fieldDescription(id, hint, error)}
        {...props}
      />
      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  )
}

export { Field, FieldMessage, fieldDescription }
