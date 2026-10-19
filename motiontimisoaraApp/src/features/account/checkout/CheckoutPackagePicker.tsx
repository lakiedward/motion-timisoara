import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function CheckoutPackagePicker({
  packages,
  value,
  onChange,
}: {
  packages: number[]
  value: number
  onChange: (size: number) => void
}) {
  const custom = !packages.includes(value)
  return (
    <section aria-labelledby="checkout-package" className="space-y-3">
      <h3 id="checkout-package" className="text-sm font-semibold">
        Pachet de ședințe
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {packages.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={value === size}
            onClick={() => onChange(size)}
            className={cn(
              'focus-visible:outline-ring min-h-touch-target rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
              value === size
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card hover:border-primary/60',
            )}
          >
            {size} ședințe
          </button>
        ))}
        <div
          className={cn(
            'bg-card flex min-h-touch-target items-center gap-2 rounded-full border pr-1 pl-4',
            custom && 'border-primary',
          )}
        >
          <Label htmlFor="custom-package" className="text-muted-foreground shrink-0 text-sm">
            Altul
          </Label>
          <Input
            id="custom-package"
            type="number"
            min={1}
            className="h-9 min-w-0 flex-1 rounded-full border-0 px-2 text-right shadow-none"
            value={value}
            onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>
    </section>
  )
}
