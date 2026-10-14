import type { Sport } from '@/api/sports'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function StepDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="sr-only">{`Pasul ${current + 1} din ${count}`}</span>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            i <= current ? 'bg-primary' : 'bg-border',
          )}
        />
      ))}
    </div>
  )
}

export function SportPicker({
  sports,
  value,
  onChange,
}: {
  sports: Sport[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="flex flex-wrap gap-2">
      {sports.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={value.includes(s.id)}
          onClick={() => toggle(s.id)}
          className={cn(
            'min-h-touch-target rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value.includes(s.id)
              ? 'border-primary bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}

export function SportsField({
  sports,
  loading,
  failed,
  onRetry,
  value,
  onChange,
}: {
  sports: Sport[]
  loading: boolean
  failed: boolean
  onRetry: () => void
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>Sporturi</Label>
      {loading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Se încarcă sporturile…
        </p>
      ) : failed ? (
        <div className="space-y-2">
          <p className="text-destructive text-sm" role="alert">
            Nu am putut încărca sporturile.
          </p>
          <Button type="button" variant="outline" onClick={onRetry}>
            Reîncearcă sporturile
          </Button>
        </div>
      ) : sports.length ? (
        <SportPicker sports={sports} value={value} onChange={onChange} />
      ) : (
        <p className="text-muted-foreground text-sm">Nu sunt sporturi disponibile momentan.</p>
      )}
    </div>
  )
}
