import { expect, test, vi } from 'vitest'

import {
  MAX_FILM_MB,
  MAX_FILM_SECUNDE,
  MAX_POZE,
  mb,
  pregatesteFisiere,
  RETENTIE_FILM_ZILE,
  termenulFilmarii,
} from './media'

/** Un fișier de mărimea cerută, fără să ținem octeții în memorie. */
function fisier(nume: string, tip: string, octeti: number): File {
  const f = new File(['x'], nume, { type: tip })
  Object.defineProperty(f, 'size', { value: octeti })
  return f
}

const MB = 1024 * 1024

test('mărimea se scrie în MB, cu o zecimală', () => {
  expect(mb(52_428_800)).toBe(50)
  expect(mb(1_572_864)).toBe(1.5)
})

// În jsdom nu există canvas, deci micșorarea cade pe fișierul original — exact
// ramura de rezervă din cod: mai bine o poză mare decât nicio poză.
test('pozele trec și sunt marcate ca imagini', async () => {
  const { pregatite, refuzate } = await pregatesteFisiere([fisier('a.jpg', 'image/jpeg', 2 * MB)])
  expect(refuzate).toEqual([])
  expect(pregatite).toHaveLength(1)
  expect(pregatite[0].fel).toBe('IMAGE')
  expect(pregatite[0].numeOriginal).toBe('a.jpg')
})

test('a șaptea poză e refuzată, cu motiv scris pentru om', async () => {
  const sapte = Array.from({ length: MAX_POZE + 1 }, (_, i) =>
    fisier(`p${i}.jpg`, 'image/jpeg', MB),
  )
  const { pregatite, refuzate } = await pregatesteFisiere(sapte)
  expect(pregatite).toHaveLength(MAX_POZE)
  expect(refuzate).toHaveLength(1)
  expect(refuzate[0]).toContain(`cel mult ${MAX_POZE} poze`)
  expect(refuzate[0]).toContain('p6.jpg')
})

test('numărul de poze ține cont de cele deja alese", nu doar de lotul curent', async () => {
  const { pregatite, refuzate } = await pregatesteFisiere(
    [fisier('inca-una.jpg', 'image/jpeg', MB)],
    { poze: MAX_POZE, filme: 0 },
  )
  expect(pregatite).toEqual([])
  expect(refuzate).toHaveLength(1)
})

// Refuzul se dă ÎNAINTE de încărcare: pe date mobile, un refuz de la server după
// ce au urcat 100 MB e o pierdere reală pentru om.
test('o filmare peste limita de mărime e refuzată, cu cifrele ei', async () => {
  const { pregatite, refuzate } = await pregatesteFisiere([
    fisier('lung.mp4', 'video/mp4', (MAX_FILM_MB + 30) * MB),
  ])
  expect(pregatite).toEqual([])
  expect(refuzate[0]).toContain('80 MB')
  expect(refuzate[0]).toContain(`limita e ${MAX_FILM_MB} MB`)
})

test('a doua filmare e refuzată', async () => {
  const { pregatite, refuzate } = await pregatesteFisiere([
    fisier('unu.mp4', 'video/mp4', 10 * MB),
    fisier('doi.mp4', 'video/mp4', 10 * MB),
  ])
  expect(pregatite).toHaveLength(1)
  expect(refuzate[0]).toContain('o singură filmare')
})

// jsdom nu poate citi metadate video, deci durata iese necunoscută. Un om nu are
// voie să fie blocat pentru că noi n-am putut citi fișierul — mărimea rămâne
// oricum verificată.
test('o durată necitibilă nu blochează filmarea', async () => {
  const { pregatite, refuzate } = await pregatesteFisiere([
    fisier('scurt.mp4', 'video/mp4', 5 * MB),
  ])
  expect(refuzate).toEqual([])
  expect(pregatite[0].fel).toBe('VIDEO')
})

test('o filmare prea lungă e refuzată cu durata ei', async () => {
  const original = HTMLMediaElement.prototype as unknown as { load?: unknown }
  void original
  const spion = vi
    .spyOn(document, 'createElement')
    .mockImplementation(((tag: string) => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement
      if (tag === 'video') {
        Object.defineProperty(el, 'duration', { value: MAX_FILM_SECUNDE + 35, writable: true })
        Object.defineProperty(el, 'src', {
          set() {
            setTimeout(() => (el as HTMLVideoElement).onloadedmetadata?.(new Event('l')), 0)
          },
        })
      }
      return el
    }) as typeof document.createElement)

  const { pregatite, refuzate } = await pregatesteFisiere([
    fisier('prea-lung.mp4', 'video/mp4', 5 * MB),
  ])
  spion.mockRestore()

  expect(pregatite).toEqual([])
  expect(refuzate[0]).toContain('95 secunde')
  expect(refuzate[0]).toContain(`limita e ${MAX_FILM_SECUNDE}`)
})

test('un fișier care nu e nici poză nici filmare e refuzat', async () => {
  const { pregatite, refuzate } = await pregatesteFisiere([
    fisier('lista.pdf', 'application/pdf', MB),
  ])
  expect(pregatite).toEqual([])
  expect(refuzate[0]).toContain('nici poză, nici filmare')
})

// Retenția agreată: filmările se șterg la 30 de zile, pozele rămân.
test('filmarea primește termen, poza nu', () => {
  const acum = new Date('2026-08-26T09:00:00Z')
  const termen = termenulFilmarii('VIDEO', acum)
  expect(termen).not.toBeNull()
  const zile = (new Date(termen!).getTime() - acum.getTime()) / (1000 * 60 * 60 * 24)
  expect(Math.round(zile)).toBe(RETENTIE_FILM_ZILE)
  expect(termenulFilmarii('IMAGE', acum)).toBeNull()
})
