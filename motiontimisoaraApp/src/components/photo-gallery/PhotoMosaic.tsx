import { useId, useRef, useState } from 'react'

import type { PozaPublica } from '@/api/photo-gallery'
import { PhotoLightbox } from './PhotoLightbox'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/plural'

const WIDE_TILES = 5
const PHONE_TILES = 3

const SCRIM = { background: 'linear-gradient(to top, var(--overlay-scrim) 0%, transparent 70%)' }

function gridClass(n: number) {
  if (n === 1) return 'sm:h-96 sm:grid-cols-1'
  if (n === 2) return 'sm:h-80 sm:grid-cols-2'
  if (n === 3) return 'sm:h-96 sm:grid-cols-[2fr_1fr] sm:grid-rows-2'
  return 'sm:h-96 sm:grid-cols-[2fr_1fr_1fr] sm:grid-rows-2'
}

function tileClass(i: number, n: number) {
  const phone =
    i === 0 || (n === 2 && i === 1)
      ? 'col-span-2 aspect-[16/10]'
      : i < PHONE_TILES
        ? 'aspect-square'
        : 'max-sm:hidden'
  const wide =
    i === 0 && n >= 3
      ? 'sm:col-span-1 sm:row-span-2'
      : n === 4 && i === 3
        ? 'sm:col-span-2'
        : 'sm:col-span-1'
  return cn(phone, 'sm:aspect-auto', wide)
}

export function PhotoMosaic({
  photos,
  alt,
  title,
  subtitle,
  sectionKey,
}: {
  photos: PozaPublica[]
  alt: string
  title: string
  subtitle: string
  sectionKey: string
}) {
  const titleId = useId()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const n = photos.length
  if (!n) return null

  const urls = photos.map((p) => p.url)
  const captions = photos.map((p) => p.caption)
  const visible = photos.slice(0, WIDE_TILES)
  const restPhone = n - PHONE_TILES
  const restWide = n - WIDE_TILES

  return (
    <section
      data-section={sectionKey}
      aria-labelledby={titleId}
      className="bg-card mt-8 rounded-xl border p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="font-display text-xl font-bold">
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        </div>
        <span className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-3 py-1 text-sm font-medium">
          {plural(n, 'poză', 'poze')}
        </span>
      </div>

      <ul className={cn('mt-4 grid grid-cols-2 gap-3', gridClass(n))}>
        {visible.map((p, i) => {
          const moreOnPhone = i === PHONE_TILES - 1 && restPhone > 0
          const moreWide = i === WIDE_TILES - 1 && restWide > 0
          return (
            <li key={p.url} className={tileClass(i, n)}>
              <button
                type="button"
                className="bg-muted focus-visible:outline-ring group relative block size-full overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={(e) => {
                  openerRef.current = e.currentTarget
                  setOpenIndex(i)
                }}
                aria-label={`Deschide poza ${i + 1} din ${n}${p.caption ? `: ${p.caption}` : ''}`}
              >
                <img
                  src={p.url}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
                />
                {p.caption && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 px-3 pt-10 pb-2.5 text-left text-sm font-semibold text-white"
                    style={SCRIM}
                  >
                    {p.caption}
                  </span>
                )}
                {(moreOnPhone || moreWide) && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'font-display absolute inset-0 flex items-center justify-center bg-(--overlay-scrim) text-lg font-bold text-white',
                      moreOnPhone && !moreWide && 'sm:hidden',
                      moreWide && !moreOnPhone && 'max-sm:hidden',
                    )}
                  >
                    +{plural(moreWide ? restWide : restPhone, 'poză', 'poze')}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-muted-foreground mt-3 text-xs">
        Poze încărcate de organizator, cu acordul scris al părinților.
      </p>

      <PhotoLightbox
        urls={urls}
        captions={captions}
        alt={alt}
        index={openIndex}
        onIndexChange={setOpenIndex}
        returnFocusRef={openerRef}
      />
    </section>
  )
}
