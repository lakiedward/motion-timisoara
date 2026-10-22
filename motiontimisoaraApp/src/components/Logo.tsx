import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showText?: boolean
  tone?: 'default' | 'on-brand'
}

export function Logo({ className, showText = true, tone = 'default' }: LogoProps) {
  const onBrand = tone === 'on-brand'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-display font-bold',
        onBrand && 'text-white',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-xl text-white',
          onBrand ? 'ring-2 ring-white/70' : 'shadow-sm',
        )}
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
          Motion <span className={onBrand ? undefined : 'text-primary'}>România</span>
        </span>
      )}
    </span>
  )
}
