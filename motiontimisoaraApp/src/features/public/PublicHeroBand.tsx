import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

export function PublicHeroBand({
  url,
  title,
  backTo,
  backLabel,
  width = 'max-w-6xl',
  media,
  children,
}: {
  url: string | null
  title: string
  backTo: string
  backLabel: string
  width?: 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl'
  media?: ReactNode
  children?: ReactNode
}) {
  if (!url) return null
  const heading = (
    <h1 className="font-display text-4xl font-extrabold text-white md:text-5xl">{title}</h1>
  )
  return (
    <section className="relative h-[46vh] min-h-[320px] overflow-hidden md:h-[52vh]">
      <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.25) 48%, transparent 72%)',
        }}
      />
      <Link
        to={backTo}
        className="absolute top-6 left-6 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/30 px-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>
      <div className="absolute inset-x-0 bottom-0">
        <div className={cn('mx-auto px-6 pb-7', width)}>
          {media || children ? (
            <div className="flex min-w-0 items-end gap-4">
              {media}
              <div className="min-w-0">
                {heading}
                {children}
              </div>
            </div>
          ) : (
            heading
          )}
        </div>
      </div>
    </section>
  )
}
