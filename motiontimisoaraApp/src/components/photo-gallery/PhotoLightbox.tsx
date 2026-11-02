import { useRef, type KeyboardEvent, type MouseEvent, type TouchEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SWIPE_THRESHOLD = 50

const roundButton = 'size-touch-target rounded-full'

export function PhotoLightbox({
  urls,
  captions,
  alt,
  index,
  onIndexChange,
  returnFocusRef,
}: {
  urls: string[]
  captions?: (string | null)[]
  alt: string
  index: number | null
  onIndexChange: (index: number | null) => void
  returnFocusRef: { current: HTMLElement | null }
}) {
  const touchStartX = useRef<number | null>(null)
  const open = index !== null && index < urls.length ? index : null
  const openUrl = open !== null ? urls[open] : null
  const caption = open !== null ? captions?.[open] : null

  const step = (delta: number) => {
    if (open === null) return
    onIndexChange((open + delta + urls.length) % urls.length)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (urls.length < 2) return
    if (e.key === 'ArrowRight') step(1)
    if (e.key === 'ArrowLeft') step(-1)
  }

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onIndexChange(null)
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
    <Dialog.Root open={openUrl !== null} onOpenChange={(o) => !o && onIndexChange(null)}>
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
            returnFocusRef.current?.focus()
            returnFocusRef.current = null
          }}
        >
          <Dialog.Title className="sr-only">
            {`${alt} — poza ${(open ?? 0) + 1} din ${urls.length}${caption ? `: ${caption}` : ''}`}
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

          {(urls.length > 1 || caption) && (
            <p
              aria-hidden="true"
              className="bg-secondary text-secondary-foreground absolute bottom-4 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full px-3 py-1 text-sm font-medium tabular-nums"
            >
              {urls.length > 1 && `${(open ?? 0) + 1} / ${urls.length}`}
              {urls.length > 1 && caption && ' · '}
              {caption}
            </p>
          )}

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
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
