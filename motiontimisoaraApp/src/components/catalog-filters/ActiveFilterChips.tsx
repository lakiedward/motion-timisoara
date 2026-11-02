import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type ActiveFilterLabel<K extends string> = { key: K; text: string }

export function ActiveFilterChips<K extends string>({
  labels,
  onRemove,
  onClear,
}: {
  labels: ActiveFilterLabel<K>[]
  onRemove: (key: K) => void
  onClear: () => void
}) {
  if (!labels.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-sm">Filtre active:</span>
      {labels.map((label) => (
        <Button
          key={label.key}
          type="button"
          variant="secondary"
          className="rounded-full"
          aria-label={`Scoate filtrul ${label.text}`}
          onClick={() => onRemove(label.key)}
        >
          {label.text}
          <X aria-hidden="true" />
        </Button>
      ))}
      <Button type="button" variant="link" onClick={onClear}>
        Șterge tot
      </Button>
    </div>
  )
}
