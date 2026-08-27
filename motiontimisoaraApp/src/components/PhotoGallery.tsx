import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const inchideRef = useRef<HTMLButtonElement>(null)
  /** De unde s-a deschis, ca focusul să se întoarcă acolo la închidere. */
  const dinRef = useRef<HTMLElement | null>(null)

  const inchide = useCallback(() => {
    setDeschisa(null)
    dinRef.current?.focus()
    dinRef.current = null
  }, [])

  const deschide = (i: number) => {
    dinRef.current = document.activeElement as HTMLElement | null
    setDeschisa(i)
  }

  /** Un pas înainte sau înapoi, cu ocolul listei la capete. */
  const muta = useCallback(
    (pas: number) => {
      setDeschisa((i) => (i === null ? null : (i + pas + urls.length) % urls.length))
    },
    [urls.length],
  )

  // Dacă lista se scurtează cât timp o poză e deschisă, indicele poate rămâne în
  // afara ei. Se rezolvă la randare, nu dintr-un efect care schimbă starea:
  // `urls[deschisa]` ar fi undefined, iar `<img src={undefined}>` cere pagina
  // curentă de la server.
  const indice = deschisa !== null && deschisa < urls.length ? deschisa : null
  const pozaDeschisa = indice !== null ? urls[indice] : null

  // Focusul intră în dialog o singură dată, LA DESCHIDERE. Legat de `indice`, ar
  // fi rulat la fiecare pas prin galerie și ar fi smuls focusul de pe săgeata
  // tocmai apăsată — adică exact butonul pe care omul voia să-l apese din nou.
  const eraDeschis = useRef(false)
  useEffect(() => {
    const deschisAcum = indice !== null
    // Fără asta, dialogul era modal doar cu numele: Tab plimba focusul pe
    // butoanele paginii de dedesubt, invizibile sub fundalul negru, iar cine
    // navighează din tastatură rămânea rătăcit.
    if (deschisAcum && !eraDeschis.current) inchideRef.current?.focus()
    eraDeschis.current = deschisAcum
  }, [indice])

  useEffect(() => {
    if (indice === null) return

    const laTasta = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        inchide()
        return
      }
      if (e.key === 'ArrowRight') {
        muta(1)
        return
      }
      if (e.key === 'ArrowLeft') {
        muta(-1)
        return
      }
      if (e.key === 'Tab') {
        // Capcana se plimbă acum printre butoanele chiar existente: cu o
        // singură poză sunt una, cu mai multe sunt trei. O listă fixă ar fi
        // sărit peste săgeți sau ar fi trimis focusul într-un buton absent.
        const butoane = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? [])]
        if (!butoane.length) return
        e.preventDefault()
        const pas = e.shiftKey ? -1 : 1
        const acum = butoane.indexOf(document.activeElement as HTMLElement)
        const urmator =
          acum === -1 ? (pas === 1 ? 0 : butoane.length - 1) : (acum + pas + butoane.length) % butoane.length
        butoane[urmator]?.focus()
      }
    }
    document.addEventListener('keydown', laTasta)
    return () => document.removeEventListener('keydown', laTasta)
  }, [indice, inchide, muta])

  if (!urls.length) return null

  return (
    <>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {urls.map((u, i) => (
          <li key={u}>
            <button
              type="button"
              className="focus-visible:ring-ring/50 block w-full overflow-hidden rounded-2xl outline-none focus-visible:ring-[3px]"
              onClick={() => deschide(i)}
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

      {pozaDeschisa && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — poza ${(indice ?? 0) + 1} din ${urls.length}`}
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/85 p-4"
          onClick={inchide}
        >
          <img
            src={pozaDeschisa}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            ref={inchideRef}
            type="button"
            className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-white/90 text-black"
            onClick={inchide}
            aria-label="Închide poza"
          >
            <X className="size-5" />
          </button>

          {/* Cu o singură poză n-ai unde să te duci, deci săgețile lipsesc cu
              totul — nu stau acolo dezactivate. `stopPropagation` fiindcă
              fundalul de dedesubt închide dialogul la clic. */}
          {urls.length > 1 && (
            <>
              <button
                type="button"
                className="absolute top-1/2 left-4 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black"
                onClick={(e) => {
                  e.stopPropagation()
                  muta(-1)
                }}
                aria-label="Poza anterioară"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                className="absolute top-1/2 right-4 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black"
                onClick={(e) => {
                  e.stopPropagation()
                  muta(1)
                }}
                aria-label="Poza următoare"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
