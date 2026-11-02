import * as React from 'react'
import { FileText, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

function FilePicker({
  id,
  label,
  hint,
  accept,
  file,
  onFileChange,
  chooseLabel = 'Alege fișierul',
  replaceLabel = 'Înlocuiește fișierul',
  disabled,
}: {
  id?: string
  label: string
  hint?: string
  accept?: string
  file: File | null
  onFileChange: (file: File | null) => void
  chooseLabel?: string
  replaceLabel?: string
  disabled?: boolean
}) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const input = React.useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {hint && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => {
          const chosen = event.target.files?.[0] ?? null
          event.target.value = ''
          if (chosen) onFileChange(chosen)
        }}
      />
      {file && (
        <p className="flex items-start gap-2 text-sm">
          <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 font-medium break-all">{file.name}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <FileText className="size-4" aria-hidden="true" />
          {file ? replaceLabel : chooseLabel}
        </Button>
        {file && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => onFileChange(null)}
          >
            <X className="size-4" aria-hidden="true" />
            Scoate fișierul
          </Button>
        )}
      </div>
    </div>
  )
}

export { FilePicker }
