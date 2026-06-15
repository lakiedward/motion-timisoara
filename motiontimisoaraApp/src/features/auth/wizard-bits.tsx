import type { Sport } from '@/api/sports'
import { cn } from '@/lib/utils'

export function StepDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
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
          onClick={() => toggle(s.id)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm transition-colors',
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
