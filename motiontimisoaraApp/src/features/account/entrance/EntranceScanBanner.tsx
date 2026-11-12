import { QrCode } from 'lucide-react'

import { isNative } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { EntranceScanButton } from './EntranceScanButton'

export function EntranceScanBanner({ className }: { className?: string }) {
  if (isNative()) return null
  return (
    <section
      data-section="entrance-scan"
      aria-label="Prezența la intrare"
      className={cn(
        'bg-card flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          <QrCode className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Ești la intrare?</span>
          <span className="text-muted-foreground block text-sm">
            Scanează foaia antrenorului și marchează-ți copilul prezent, de la 15 minute înainte de
            ședință până la final.
          </span>
        </span>
      </div>
      <EntranceScanButton className="w-full shrink-0 sm:w-auto" />
    </section>
  )
}
