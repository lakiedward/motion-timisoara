import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PhotoLightbox } from './PhotoLightbox'

const PHONE_LIMIT = 6
const WIDE_LIMIT = 8

export default function PhotoGallery({ urls, alt }: { urls: string[]; alt: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const openerRef = useRef<HTMLElement | null>(null)

  if (!urls.length) return null

  const visible = expanded ? urls : urls.slice(0, WIDE_LIMIT)
  const hasMore = urls.length > PHONE_LIMIT
  const moreOnlyOnPhone = urls.length <= WIDE_LIMIT

  return (
    <>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {visible.map((u, i) => (
          <li key={u} className={cn(!expanded && i >= PHONE_LIMIT && 'max-sm:hidden')}>
            <button
              type="button"
              className="bg-muted block aspect-square w-full overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={(e) => {
                openerRef.current = e.currentTarget
                setOpenIndex(i)
              }}
              aria-label={`Deschide poza ${i + 1} din ${urls.length}`}
            >
              {!failed.has(u) && (
                <img
                  src={u}
                  alt=""
                  loading="lazy"
                  onError={() => setFailed((prev) => new Set(prev).add(u))}
                  className="size-full object-cover transition-transform hover:scale-105"
                />
              )}
            </button>
          </li>
        ))}
      </ul>

      {hasMore && (
        <Button
          type="button"
          variant="outline"
          className={cn('mt-3 h-touch-target min-h-touch-target', moreOnlyOnPhone && 'sm:hidden')}
          onClick={() => setExpanded((d) => !d)}
          aria-expanded={expanded}
        >
          {expanded ? 'Vezi mai puține' : `Vezi toate cele ${urls.length} poze`}
        </Button>
      )}

      <PhotoLightbox
        urls={urls}
        alt={alt}
        index={openIndex}
        onIndexChange={setOpenIndex}
        returnFocusRef={openerRef}
      />
    </>
  )
}
