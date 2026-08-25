/**
 * Cautarea de adrese si reverse geocoding-ul din spatele selectorului de punct
 * de pe harta (`src/components/LocationPicker.tsx`).
 *
 * Furnizorul e Photon (https://photon.komoot.io) — aceleasi date OpenStreetMap
 * ca placile de pe /harta, dar cu o politica de folosire care PERMITE explicit
 * cautarea pe masura ce scrii: „search as you type" e chiar titlul paginii lor.
 * Nominatim, cealalta optiune fara cheie, interzice pe nume autocomplete-ul din
 * client — „you must not implement such a service on the client side using the
 * API", https://operations.osmfoundation.org/policies/nominatim/, sectiunea
 * „Unacceptable Use". Deci nu mutati cererile de mai jos pe Nominatim.
 *
 * Tot ce e specific furnizorului (URL, forma raspunsului) sta in acest fisier.
 * Restul aplicatiei vede doar tipul `GeoPlace` si obiectul `geocoding`.
 */

/** Timisoara: centrul pentru favorizarea rezultatelor si cutia care le limiteaza. */
const TIMISOARA = { lat: 45.7489, lng: 21.2087 }
/** minLon,minLat,maxLon,maxLat — fara ea, „Strada Alba Iulia" aduce si Aradul. */
const BBOX = '21.13,45.68,21.33,45.82'

/**
 * Photon accepta doar `default`, `de`, `en` si `fr`. `lang=ro` nu e o limba
 * suportata si intoarce un obiect de eroare in loc de rezultate — adica zero
 * sugestii, in tacere. `default` da chiar numele locale, cu diacritice.
 */
const LANG = 'default'

const BASE_URL = 'https://photon.komoot.io'

/** Un loc ales de utilizator, in forma de care are nevoie formularul. */
export type GeoPlace = {
  id: string
  /** Linia principala din lista de sugestii. */
  label: string
  /** Linia secundara din lista de sugestii; poate fi goala. */
  detail: string
  /** Ce intra in campul Adresa. Null cand furnizorul nu stie strada. */
  address: string | null
  /** Ce intra in campul Oras. Null cand furnizorul nu stie localitatea. */
  city: string | null
  lat: number
  lng: number
}

type PhotonProperties = {
  osm_id?: number
  osm_type?: string
  name?: string
  street?: string
  housenumber?: string
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  postcode?: string
}

type PhotonFeature = {
  properties?: PhotonProperties
  geometry?: { coordinates?: [number, number] }
}

/**
 * Photon raspunde GeoJSON: coordonatele vin `[longitudine, latitudine]`, in
 * ordinea GeoJSON — invers fata de cum le scriem noi peste tot. Inversarea lor
 * e greseala clasica pe furnizorul asta, de aceea conversia se face o singura
 * data, aici.
 */
function toPlace(feature: PhotonFeature, index: number): GeoPlace | null {
  const p = feature.properties ?? {}
  const coords = feature.geometry?.coordinates
  const lng = coords?.[0]
  const lat = coords?.[1]
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const city = p.city ?? p.town ?? p.village ?? p.county ?? null

  // Pentru o strada, Photon lasa `street` gol si pune numele strazii in `name`;
  // pentru o casa sau un punct de interes cu adresa, `street` e completat. Cand
  // rezultatul e chiar orasul, `name` e numele orasului — aia nu e o strada.
  const numeStrada = p.street ?? p.name ?? null
  const street = numeStrada && numeStrada !== city ? numeStrada : null
  const address = [street, p.housenumber].filter(Boolean).join(' ') || null

  const label = p.name ?? address ?? city ?? 'Punct pe hartă'
  const detail = [address === label ? null : address, city, p.postcode]
    .filter(Boolean)
    .join(', ')

  return {
    // Indexul face parte din id fiindca Photon poate intoarce acelasi obiect OSM
    // de doua ori intr-un raspuns (verificat pe „Piata Victoriei"), iar o lista
    // cu doua chei identice e o eroare React.
    id: `${p.osm_type ?? ''}${p.osm_id ?? ''}-${index}`,
    label,
    detail,
    address,
    city,
    lat,
    lng,
  }
}

async function fetchFeatures(url: string, signal?: AbortSignal): Promise<GeoPlace[]> {
  // Fara headere proprii: asa cererea ramane „simple" pentru CORS si sare peste
  // preflight, iar Photon raspunde cu `Access-Control-Allow-Origin: *` — ceea ce
  // o face sa mearga si din WebView-ul nativ (`capacitor://localhost`).
  const raspuns = await fetch(url, { signal })
  if (!raspuns.ok) throw new Error(`Geocoding ${raspuns.status}`)
  const json: { features?: PhotonFeature[] } = await raspuns.json()
  return (json.features ?? []).map(toPlace).filter((p): p is GeoPlace => p !== null)
}

export const geocoding = {
  /** Sugestii pentru textul scris de utilizator, favorizate spre Timisoara. */
  async search(query: string, signal?: AbortSignal): Promise<GeoPlace[]> {
    const q = query.trim()
    if (q.length < 3) return []
    const url =
      `${BASE_URL}/api?q=${encodeURIComponent(q)}` +
      `&limit=5&lang=${LANG}&lat=${TIMISOARA.lat}&lon=${TIMISOARA.lng}&bbox=${BBOX}`
    return fetchFeatures(url, signal)
  },

  /** Adresa din dreptul unui punct de pe harta. Null cand nu se poate afla. */
  async reverse(lat: number, lng: number, signal?: AbortSignal): Promise<GeoPlace | null> {
    const de_baza = `${BASE_URL}/reverse?lat=${lat}&lon=${lng}&limit=1&lang=${LANG}`
    // `layer=house` intai: fara el, un punct langa centrul orasului intoarce
    // poligonul orasului, deci un rezultat fara strada. Daca nu exista casa in
    // apropiere, a doua incercare accepta orice — macar orasul se completeaza.
    const cuCasa = await fetchFeatures(`${de_baza}&layer=house&radius=1`, signal)
    if (cuCasa.length > 0) return cuCasa[0]
    const oricare = await fetchFeatures(de_baza, signal)
    return oricare[0] ?? null
  },
}
