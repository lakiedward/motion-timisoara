import { Browser } from '@capacitor/browser'
import * as Dialog from '@radix-ui/react-dialog'
import { Download, Link2, X } from 'lucide-react'
import type { MouseEvent } from 'react'

import type { AtasamentAfisabil } from '@/api/attachments'
import { Button } from '@/components/ui/button'
import { isNative } from '@/lib/platform'

function describeExpiry(iso: string): string {
  const expiry = new Date(iso)
  if (expiry.getTime() <= Date.now()) return 'Filmarea se șterge în curând.'
  return `Filmarea se șterge pe ${expiry.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}.`
}

function getExternalLink(value: string): { href: string; label: string } | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    const pathSegment = url.pathname.split('/').filter(Boolean).at(-1)
    let name = pathSegment
    if (pathSegment) {
      try {
        name = decodeURIComponent(pathSegment)
      } catch {
        name = pathSegment
      }
    }
    return {
      href: url.href,
      label: name ? `${name} (${url.hostname})` : url.hostname,
    }
  } catch {
    return null
  }
}

function openDownloadNatively(event: MouseEvent<HTMLAnchorElement>, url: string) {
  if (!isNative()) return
  event.preventDefault()
  void Browser.open({ url })
}

function AnnouncementImage({
  attachment,
  position,
  total,
}: {
  attachment: AtasamentAfisabil
  position: number
  total: number
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="focus-visible:outline-ring block w-full overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={`Deschide poza ${position} din ${total}`}
        >
          <img
            src={attachment.link}
            alt=""
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform hover:scale-105 motion-reduce:transition-none"
          />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-background/90 fixed inset-0 z-50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-card text-card-foreground fixed inset-4 z-50 rounded-xl border p-4 shadow-lg outline-none"
        >
          <Dialog.Title className="sr-only">
            Poză mărită {position} din {total}
          </Dialog.Title>
          <img
            src={attachment.link}
            alt={`Poză ${position} din ${total} atașată anunțului`}
            className="h-full w-full rounded-lg object-contain"
          />
          <Dialog.Close asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-4 right-4 size-11"
              aria-label="Închide poza"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function AnnouncementMedia({ atasamente }: { atasamente: AtasamentAfisabil[] }) {
  const images = atasamente.filter((attachment) => attachment.fel === 'IMAGE')
  const videos = atasamente.filter((attachment) => attachment.fel === 'VIDEO')
  const links = atasamente.flatMap((attachment) => {
    if (attachment.fel !== 'URL') return []
    const link = getExternalLink(attachment.link)
    return link ? [{ ...link, id: attachment.id }] : []
  })

  if (!images.length && !videos.length && !links.length) return null

  return (
    <div className="mt-3 space-y-3">
      {!!images.length && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((attachment, index) => (
            <li key={attachment.id}>
              <AnnouncementImage
                attachment={attachment}
                position={index + 1}
                total={images.length}
              />
            </li>
          ))}
        </ul>
      )}

      {videos.map((attachment) => {
        const downloadUrl = attachment.linkDescarcare ?? attachment.link
        return (
          <div key={attachment.id} className="space-y-1.5">
            <video
              src={attachment.link}
              controls
              preload="metadata"
              aria-label="Filmare atașată anunțului"
              className="bg-muted max-h-96 w-full rounded-xl"
            />
            {attachment.expiraLa && (
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>{describeExpiry(attachment.expiraLa)}</span>
                <Button asChild variant="link" className="h-auto min-h-11 p-0 text-xs">
                  <a
                    href={downloadUrl}
                    download
                    onClick={(event) => openDownloadNatively(event, downloadUrl)}
                  >
                    <Download className="size-3.5" aria-hidden="true" /> Descarcă
                  </a>
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {!!links.length && (
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id}>
              <Button
                asChild
                variant="link"
                className="h-auto min-h-11 max-w-full p-0 text-left whitespace-normal"
              >
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${link.label} (se deschide într-o filă nouă)`}
                >
                  <Link2 className="size-4" aria-hidden="true" />
                  <span className="min-w-0 wrap-anywhere">{link.label}</span>
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
