import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type TouchEvent,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PHONE_LIMIT = 6
const WIDE_LIMIT = 8
const SWIPE_THRESHOLD = 50

const roundButton = 'size-touch-target rounded-full'

export default function PhotoGallery({ urls, alt }: { urls: string[]; alt: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const touchStartX = useRef<number | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const index = openIndex !== null && openIndex < urls.length ? openIndex : null
  const openUrl = index !== null ? urls[index] : null

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((i) => (i === null ? null : (i + delta + urls.length) % urls.length))
    },
    [urls.length],
  )

  if (!urls.length) return null

  const visible = expanded ? urls : urls.slice(0, WIDE_LIMIT)
  const hasMore = urls.length > PHONE_LIMIT
  const moreOnlyOnPhone = urls.length <= WIDE_LIMIT

  const onKeyDown = (e: KeyboardEvent) => {
    if (urls.length < 2) return
    if (e.key === 'ArrowRight') step(1)
    if (e.key === 'ArrowLeft') step(-1)
  }

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setOpenIndex(null)
  }

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    const end = e.changedTouches[0]?.clientX
    if (start === null || end === undefined || urls.length < 2) return
    const dx = end - start
    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    step(dx < 0 ? 1 : -1)
  }

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
          className={cn('mt-3 h-11 min-h-11', moreOnlyOnPhone && 'sm:hidden')}
          onClick={() => setExpanded((d) => !d)}
          aria-expanded={expanded}
        >
          {expanded ? 'Vezi mai puține' : `Vezi toate cele ${urls.length} poze`}
        </Button>
      )}

      <Dialog.Root open={openUrl !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-(--overlay-scrim)" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
            onClick={onBackdropClick}
            onKeyDown={onKeyDown}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              openerRef.current?.focus()
              openerRef.current = null
            }}
          >
            <Dialog.Title className="sr-only">
              {`${alt} — poza ${(index ?? 0) + 1} din ${urls.length}`}
            </Dialog.Title>
            {openUrl && (
              <img
                src={openUrl}
                alt=""
                className="max-h-full max-w-full rounded-2xl object-contain"
              />
            )}
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={cn(roundButton, 'absolute top-4 right-4')}
                aria-label="Închide poza"
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>

            {urls.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={cn(roundButton, 'absolute top-1/2 left-4 -translate-y-1/2')}
                  onClick={() => step(-1)}
                  aria-label="Poza anterioară"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={cn(roundButton, 'absolute top-1/2 right-4 -translate-y-1/2')}
                  onClick={() => step(1)}
                  aria-label="Poza următoare"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </Button>
                <p
                  aria-hidden="true"
                  className="bg-secondary text-secondary-foreground absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-medium tabular-nums"
                >
                  {(index ?? 0) + 1} / {urls.length}
                </p>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
