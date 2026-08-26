/**
 * Pregătirea pozelor și a filmărilor de la antrenament, înainte să plece spre server.
 *
 * Regulile vin din decizia proprietarului, 2026-08-26, luată pe cifre: o filmare
 * de un minut la 1080p, cum filmează telefonul din fabrică, are 90–130 MB; la
 * 720p are 20–30 MB, iar pe telefonul părintelui diferența aproape că nu se vede.
 * Un club cu 5 cursuri și două antrenamente pe săptămână adună ~250 MB pe
 * săptămână, deci 13 GB pe an dacă nu se șterge nimic.
 *
 * De aceea filmările se resping ÎNAINTE de încărcare, nu după: pe date mobile,
 * un refuz de la server după ce au urcat 100 MB e o pierdere reală pentru om.
 */

export const MAX_POZE = 6
export const MAX_FILME = 1
export const MAX_FILM_MB = 50
export const MAX_FILM_SECUNDE = 60
/** Latura lungă la care se micșorează pozele. */
export const LATURA_POZA = 1600
/** După câte zile se șterge o filmare. Pozele rămân. */
export const RETENTIE_FILM_ZILE = 30
/** Cât așteptăm metadatele unei filmări înainte să renunțăm la citirea duratei. */
export const CITIRE_METADATE_MS = 2500

export type FelAtasament = 'IMAGE' | 'VIDEO'

/** Un fișier ales de om, gata pregătit sau respins cu motiv. */
export type FisierPregatit = {
  fel: FelAtasament
  /** Ce se încarcă efectiv: poza micșorată, sau filmarea neatinsă. */
  continut: Blob
  numeOriginal: string
  contentType: string
}

export function esteImagine(f: File): boolean {
  return f.type.startsWith('image/')
}

export function esteFilm(f: File): boolean {
  return f.type.startsWith('video/')
}

export function mb(octeti: number): number {
  return Math.round((octeti / (1024 * 1024)) * 10) / 10
}

/**
 * Mărimea scrisă pentru om.
 *
 * O poză micșorată ajunge la 30–400 KB, iar în MB cu o zecimală asta se citea
 * „0 MB” — adică fișierul părea gol. Sub un MB scriem kilobiți.
 */
export function marime(octeti: number): string {
  if (octeti < 1024 * 1024) return `${Math.max(1, Math.round(octeti / 1024))} KB`
  return `${mb(octeti)} MB`
}

/**
 * Durata unei filmări, citită din metadatele fișierului.
 *
 * Întoarce `null` când browserul nu poate citi containerul — se întâmplă cu unele
 * formate de pe telefon. Apelantul trebuie să trateze necunoscutul ca pe „las-o
 * să treacă”, nu ca pe un refuz: mărimea rămâne oricum verificată, iar a bloca un
 * om pentru că nu i-am putut citi fișierul e mai rău decât a lăsa să treacă un
 * clip ceva mai lung.
 */
export function durataFilmului(f: File): Promise<number | null> {
  return new Promise((resolve) => {
    let raspuns = false
    let url: string | null = null
    const gata = (valoare: number | null) => {
      if (raspuns) return
      raspuns = true
      clearTimeout(ceas)
      if (url) URL.revokeObjectURL(url)
      resolve(valoare)
    }

    // Termenul nu e prudență teoretică: dacă browserul nu poate deschide
    // containerul, s-ar putea să nu declanșeze NICIUN eveniment — nici
    // `loadedmetadata`, nici `error` — iar promisiunea ar rămâne nerezolvată,
    // deci formularul ar aștepta la nesfârșit, fără ca omul să afle de ce.
    const ceas = setTimeout(() => gata(null), CITIRE_METADATE_MS)

    try {
      url = URL.createObjectURL(f)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () =>
        gata(Number.isFinite(video.duration) ? Math.round(video.duration) : null)
      video.onerror = () => gata(null)
      video.src = url
    } catch {
      gata(null)
    }
  })
}

/**
 * Micșorează o poză la `LATURA_POZA` pe latura lungă și o recomprimă JPEG.
 *
 * O poză de telefon are 3–6 MB; după asta ajunge la 200–400 KB, adică sub 1 GB pe
 * an pentru un club întreg. Se face în browser, deci pe conexiunea omului urcă
 * fișierul mic, nu cel mare.
 *
 * Dacă randarea eșuează din orice motiv, întoarce fișierul original: mai bine o
 * poză mare decât nicio poză.
 */
export async function micsoreazaPoza(f: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(f)
    const scara = Math.min(1, LATURA_POZA / Math.max(bitmap.width, bitmap.height))
    if (scara === 1 && f.size < 1024 * 1024) {
      bitmap.close()
      return f
    }
    const latime = Math.round(bitmap.width * scara)
    const inaltime = Math.round(bitmap.height * scara)
    const canvas = document.createElement('canvas')
    canvas.width = latime
    canvas.height = inaltime
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return f
    }
    ctx.drawImage(bitmap, 0, 0, latime, inaltime)
    bitmap.close()
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob((b) => r(b), 'image/jpeg', 0.85),
    )
    return blob ?? f
  } catch {
    return f
  }
}

/**
 * Verifică un lot de fișiere alese și le pregătește pe cele bune.
 *
 * `refuzate` conține motive scrise pentru om, nu coduri: fiecare spune ce fișier
 * și de ce, ca să știe pe care să-l scoată.
 */
export async function pregatesteFisiere(
  fisiere: File[],
  dejaAlese: { poze: number; filme: number } = { poze: 0, filme: 0 },
): Promise<{ pregatite: FisierPregatit[]; refuzate: string[] }> {
  const pregatite: FisierPregatit[] = []
  const refuzate: string[] = []
  let poze = dejaAlese.poze
  let filme = dejaAlese.filme

  for (const f of fisiere) {
    if (esteImagine(f)) {
      if (poze >= MAX_POZE) {
        refuzate.push(`„${f.name}" — poți pune cel mult ${MAX_POZE} poze la un anunț.`)
        continue
      }
      const continut = await micsoreazaPoza(f)
      poze += 1
      pregatite.push({
        fel: 'IMAGE',
        continut,
        numeOriginal: f.name,
        contentType: continut.type || f.type || 'image/jpeg',
      })
      continue
    }

    if (esteFilm(f)) {
      if (filme >= MAX_FILME) {
        refuzate.push(`„${f.name}" — poți pune o singură filmare la un anunț.`)
        continue
      }
      if (f.size > MAX_FILM_MB * 1024 * 1024) {
        refuzate.push(
          `„${f.name}" are ${mb(f.size)} MB, iar limita e ${MAX_FILM_MB} MB. Filmează mai scurt sau taie clipul.`,
        )
        continue
      }
      const durata = await durataFilmului(f)
      if (durata !== null && durata > MAX_FILM_SECUNDE) {
        refuzate.push(
          `„${f.name}" durează ${durata} secunde, iar limita e ${MAX_FILM_SECUNDE}. Taie clipul și încearcă din nou.`,
        )
        continue
      }
      filme += 1
      pregatite.push({
        fel: 'VIDEO',
        continut: f,
        numeOriginal: f.name,
        contentType: f.type || 'video/mp4',
      })
      continue
    }

    refuzate.push(`„${f.name}" nu e nici poză, nici filmare.`)
  }

  return { pregatite, refuzate }
}

/** Când se șterge o filmare încărcată acum. Pozele nu expiră, deci întorc gol. */
export function termenulFilmarii(fel: FelAtasament, acum = new Date()): string | null {
  if (fel !== 'VIDEO') return null
  const t = new Date(acum)
  t.setDate(t.getDate() + RETENTIE_FILM_ZILE)
  return t.toISOString()
}
