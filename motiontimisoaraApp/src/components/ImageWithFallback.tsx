import * as React from 'react'

import { cn } from '@/lib/utils'

type ImageWithFallbackProps = Omit<React.ComponentProps<'img'>, 'src'> & {
  src?: string | null
  fallbackSrc?: string
}

/** <img> that swaps to a fallback (or a muted placeholder) when the source is missing or fails. */
export function ImageWithFallback({
  src,
  fallbackSrc,
  alt = '',
  className,
  ...props
}: ImageWithFallbackProps) {
  const [errored, setErrored] = React.useState(false)
  const resolved = !src || errored ? fallbackSrc : src

  if (!resolved) {
    return (
      <div
        aria-label={alt || undefined}
        className={cn('bg-muted text-muted-foreground/40 grid place-items-center', className)}
      />
    )
  }

  return (
    <img
      src={resolved}
      alt={alt}
      onError={() => setErrored(true)}
      className={className}
      {...props}
    />
  )
}
