const LEVEL_RO: Record<string, string> = {
  incepator: 'Începător',
  intermediar: 'Intermediar',
  avansat: 'Avansat',
}

/** Display label for a course level slug (diacritics). Falls back to the raw value. */
export function formatLevel(level: string | null | undefined): string | null {
  if (!level) return null
  return LEVEL_RO[level.toLowerCase()] ?? level
}

/**
 * Semnele diacritice combinate pe care le lasa in urma `normalize('NFD')`.
 * Construit din escape-uri, nu scris literal: intre paranteze drepte ar fi doua
 * caractere invizibile, pe care nimeni nu le poate citi intr-un review.
 */
const SEMNE_COMBINATE = new RegExp('[\\u0300-\\u036f]', 'g')

/**
 * Slug-ul canonic pentru un nivel scris oricum: cu diacritice („începător"), cu
 * majuscule sau cu spatii in plus. Intoarce sir gol cand nu recunoaste valoarea —
 * apelantul decide ce face cu ea, ca sa nu inventam un nivel pe care nimeni nu l-a ales.
 *
 * Exista fiindca in `children.level` s-au strans si valori cu diacritice, iar un
 * `<select>` cu optiuni pe slug nu le potrivea: cadea pe „fara selectie" si prima
 * salvare stergea nivelul, fara ca parintele sa fi atins campul.
 */
export function toLevelSlug(level: string | null | undefined): string {
  if (!level) return ''
  const faraDiacritice = level.normalize('NFD').replace(SEMNE_COMBINATE, '').toLowerCase().trim()
  return faraDiacritice in LEVEL_RO ? faraDiacritice : ''
}
