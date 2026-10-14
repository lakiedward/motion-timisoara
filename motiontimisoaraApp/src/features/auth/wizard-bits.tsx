import type { Sport } from '@/api/sports'
import { cn } from '@/lib/utils'

export function StepDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="sr-only">{`Pasul ${current + 1} din ${count}`}</span>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= current ? 'bg-primary' : 'bg-border')}
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
  if (!sports.length) return <p className="text-muted-foreground text-sm">Se încarcă sporturile…</p>
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
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}
