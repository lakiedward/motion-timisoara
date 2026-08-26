import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

import type { AtasamentAfisabil } from '@/api/attachments'

/** „26 septembrie”, pentru termenul filmării. */
function ziuaSiLuna(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
}

/**
 * Pozele și filmarea de la antrenament, așa cum le vede clubul și părintele.
 *
 * Filmarea are termen: se șterge la 30 de zile, iar cardul o spune de la
 * publicare, nu în ziua dinainte. Butonul de descărcare e acolo pentru părintele
 * care vrea să păstreze clipul cu copilul lui — după termen nu mai există nicăieri.
 */
export default function AnnouncementMedia({
  atasamente,
}: {
  atasamente: AtasamentAfisabil[]
}) {
  const [deschisa, setDeschisa] = useState<AtasamentAfisabil | null>(null)
  const poze = atasamente.filter((a) => a.fel === 'IMAGE')
  const filme = atasamente.filter((a) => a.fel === 'VIDEO')

  // Escape închide lightbox-ul: cine îl deschide din tastatură trebuie să-l poată
  // și închide de acolo, fără să caute butonul cu mouse-ul.
  useEffect(() => {
    if (!deschisa) return
    const laTasta = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeschisa(null)
    }
    document.addEventListener('keydown', laTasta)
    return () => document.removeEventListener('keydown', laTasta)
  }, [deschisa])

  if (!atasamente.length) return null

  return (
    <div className="mt-3 space-y-3">
      {!!poze.length && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {poze.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="focus-visible:ring-ring/50 block w-full overflow-hidden rounded-xl outline-none focus-visible:ring-[3px]"
                onClick={() => setDeschisa(p)}
                aria-label={`Deschide poza ${i + 1} din ${poze.length}`}
              >
                <img
                  src={p.link}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {filme.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <video
            src={f.link}
            controls
            preload="metadata"
            className="max-h-96 w-full rounded-xl bg-black"
          />
          {f.expiraLa && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>Filmarea se șterge pe {ziuaSiLuna(f.expiraLa)}.</span>
              <a
                href={f.link}
                download
                className="text-primary inline-flex items-center gap-1 font-medium"
              >
                <Download className="size-3.5" /> Descarcă
              </a>
            </div>
          )}
        </div>
      ))}

      {deschisa && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Poză mărită"
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setDeschisa(null)}
        >
          <img
            src={deschisa.link}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-white/90 text-black"
            onClick={() => setDeschisa(null)}
            aria-label="Închide poza"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
