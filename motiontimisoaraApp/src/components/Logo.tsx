import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showText?: boolean
}

/** Brand mark: an azure tile with a dynamic "motion" peaks line + wordmark. */
export function Logo({ className, showText = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display font-bold', className)}>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm"
        style={{ background: 'var(--gradient-primary)' }}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 17 L8 7 L12 13 L16 5 L21 17" />
        </svg>
      </span>
      {showText && (
        <span className="text-lg leading-none tracking-tight">
          Motion <span className="text-primary">Timișoara</span>
        </span>
      )}
    </span>
  )
}
