import { isNative } from '@/lib/platform'

/**
 * Deschiderea galeriei de pe telefon.
 *
 * Pe web, `<input type="file" accept="image/*,video/*">` fără `capture` e destul:
 * atât Safari pe iOS cât și Chrome pe Android arată un selector care conține
 * galeria foto. `capture` ar forța camera și ar ascunde tocmai galeria, deci nu
 * se pune.
 *
 * În aplicația nativă însă, acelasi input trăiește într-un WebView, unde de multe
 * ori deschide managerul de fișiere, nu galeria — pe Android depinde de cum e
 * configurat `WebChromeClient`, iar rezultatul e „Documente / Descărcări" în loc
 * de pozele omului. De aceea, pe nativ, cerem galeria direct plugin-ului.
 *
 * `@capacitor/camera` era deja în dependențe și nefolosit; `chooseFromGallery` e
 * metoda actuală (`pickImages` și `getPhoto` sunt depreciate în versiunea asta).
 */
export function galeriaSeDeschideNativ(): boolean {
  return isNative()
}

/** Numele sub care salvăm ce vine din galeria nativă, când plugin-ul nu dă unul. */
function numeDinCale(cale: string, esteFilm: boolean): string {
  const bucata = cale.split('?')[0].split('/').pop() ?? ''
  if (bucata.includes('.')) return bucata
  return esteFilm ? 'filmare.mp4' : 'poza.jpg'
}

/**
 * Deschide galeria telefonului și întoarce fișierele alese.
 *
 * Rezultatele plugin-ului sunt căi, nu octeți, deci fiecare e adus prin `fetch`
 * peste calea convertită pentru WebView. Un fișier care nu poate fi citit e sărit,
 * nu aruncat: mai bine trei poze din patru decât un mesaj de eroare pe tot lotul.
 */
export async function alegeDinGalerie(limita: number): Promise<File[]> {
  const [{ Camera, MediaType, MediaTypeSelection }, { Capacitor }] = await Promise.all([
    import('@capacitor/camera'),
    import('@capacitor/core'),
  ])

  const { results } = await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.All,
    allowMultipleSelection: true,
    limit: limita,
  })

  const fisiere: File[] = []
  for (const r of results ?? []) {
    const sursa = r.webPath ?? (r.uri ? Capacitor.convertFileSrc(r.uri) : null)
    if (!sursa) continue
    try {
      const raspuns = await fetch(sursa)
      const blob = await raspuns.blob()
      const esteFilm = r.type === MediaType.Video
      const tip = blob.type || (esteFilm ? 'video/mp4' : 'image/jpeg')
      fisiere.push(
        new File([blob], numeDinCale(r.uri ?? r.webPath ?? '', esteFilm), { type: tip }),
      )
    } catch {
      // Un fișier ilizibil nu are voie să pice tot lotul.
    }
  }
  return fisiere
}
