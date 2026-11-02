import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { SportIllustration } from '@/components/sport/SportIllustration'

export const OFFER_GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export type OfferMeta = { key: string; icon?: LucideIcon; content: ReactNode }

export function OfferCard({
  to,
  title,
  imageUrl,
  sportCode,
  sportName,
  full,
  fullLabel = 'Locuri epuizate',
  meta,
  price,
  priceSuffix,
  headingLevel = 'h2',
}: {
  to: string
  title: string
  imageUrl: string | null
  sportCode?: string | null
  sportName?: string | null
  full?: boolean
  fullLabel?: string
  meta: Array<OfferMeta | null | undefined | false | ''>
  price?: ReactNode
  priceSuffix?: string
  headingLevel?: 'h2' | 'h3'
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const Heading = headingLevel

  return (
    <article className="group bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card relative flex h-full cursor-pointer flex-col rounded-xl border transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none">
      <div className="relative aspect-video overflow-hidden rounded-t-xl">
        {imageUrl && !photoFailed ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <SportIllustration code={sportCode ?? undefined} />
        )}
        {sportName && <Badge className="absolute top-3 left-3">{sportName}</Badge>}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Heading className="font-display text-foreground text-lg font-semibold tracking-tight">
            <Link
              to={to}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {title}
            </Link>
          </Heading>
          {full && <Badge variant="destructive">{fullLabel}</Badge>}
        </div>

        <ul className="text-muted-foreground mt-3 space-y-1 text-sm">
          {meta.map((item) => {
            if (!item) return null
            const Icon = item.icon
            return (
              <li key={item.key} className="flex min-w-0 items-center gap-1.5">
                {Icon ? (
                  <>
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">{item.content}</span>
                  </>
                ) : (
                  item.content
                )}
              </li>
            )
          })}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          {price ? (
            <span className="font-display text-foreground text-lg font-bold">
              {price}
              {priceSuffix && (
                <span className="text-muted-foreground font-sans text-sm font-normal">
                  {' '}
                  {priceSuffix}
                </span>
              )}
            </span>
          ) : (
            <span />
          )}
          <span
            aria-hidden="true"
            className="text-muted-foreground group-hover:text-primary inline-flex items-center gap-1 text-sm font-semibold transition-colors"
          >
            Detalii <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  )
}

export function OrganizerLine({ prefix, name }: { prefix: string; name: string }) {
  return (
    <>
      {prefix} <span className="text-foreground font-medium">{name}</span>
    </>
  )
}
