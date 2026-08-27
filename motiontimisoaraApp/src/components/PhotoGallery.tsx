import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/**
 * O galerie de poze publice, cu vizualizare mărită.
 *
 * Deliberat separată de `AnnouncementMedia`: acolo pozele sunt private, vin cu
 * linkuri semnate, stau lângă o filmare cu termen și un buton de descărcare.
 * Aici sunt poze publice de prezentare. Formele diferă prea mult ca să merite
 * o singură componentă cu opțiuni.
 */
export default function PhotoGallery({ urls, alt }: { urls: string[]; alt: string }) {
  const [deschisa, setDeschisa] = useState<number | null>(null)

  useEffect(() => {
    if (deschisa === null) return
    const laTasta = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeschisa(null)
      if (e.key === 'ArrowRight') setDeschisa((i) => (i === null ? null : (i + 1) % urls.length))
      if (e.key === 'ArrowLeft')
        setDeschisa((i) => (i === null ? null : (i - 1 + urls.length) % urls.length))
    }
    document.addEventListener('keydown', laTasta)
    return () => document.removeEventListener('keydown', laTasta)
  }, [deschisa, urls.length])

  if (!urls.length) return null

  return (
    <>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {urls.map((u, i) => (
          <li key={u}>
            <button
              type="button"
              className="focus-visible:ring-ring/50 block w-full overflow-hidden rounded-2xl outline-none focus-visible:ring-[3px]"
              onClick={() => setDeschisa(i)}
              aria-label={`Deschide poza ${i + 1} din ${urls.length}`}
            >
              <img
                src={u}
                alt=""
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {deschisa !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — poza ${deschisa + 1} din ${urls.length}`}
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setDeschisa(null)}
        >
          <img
            src={urls[deschisa]}
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
    </>
  )
}
