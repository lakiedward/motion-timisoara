/** Intervalele oferite de filtrul de perioadă din istoricul de prezență. */
export type Perioada = 'toate' | 'luna' | 'trei-luni'

/**
 * Aceeași zi, cu `luni` luni în urmă.
 *
 * `new Date(an, luna - 3, zi)` singur nu ajunge: dacă luna țintă n-are ziua cerută,
 * constructorul dă pe dinafară în luna următoare — pe 31 mai, „acum 3 luni" ar
 * deveni 3 martie, deci fereastra s-ar deschide mai târziu decât trebuie și ar
 * scăpa ședințe care încă intră în interval. Când se întâmplă, ne oprim la ultima
 * zi a lunii țintă.
 */
function cuLuniInUrma(reper: Date, luni: number): Date {
  const an = reper.getFullYear()
  const luna = reper.getMonth() - luni
  const candidat = new Date(an, luna, reper.getDate())
  const lunaAsteptata = ((luna % 12) + 12) % 12
  if (candidat.getMonth() !== lunaAsteptata) {
    // Ziua 0 a lunii următoare = ultima zi a lunii țintă.
    return new Date(an, luna + 1, 0)
  }
  return candidat
}

/** Momentul de la care o ședință intră în perioada aleasă. Null = fără limită. */
export function inceputPerioada(perioada: Perioada, acum = new Date()): Date | null {
  if (perioada === 'luna') return new Date(acum.getFullYear(), acum.getMonth(), 1)
  if (perioada === 'trei-luni') return cuLuniInUrma(acum, 3)
  return null
}
