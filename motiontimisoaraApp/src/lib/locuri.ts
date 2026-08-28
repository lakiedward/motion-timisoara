import type { LocationRow } from '@/api/public'

/**
 * Harta desenează LOCURI, nu rânduri din baza de date.
 *
 * Fiecare club își face propriul rând pentru aceeași clădire, deci N cluburi
 * care se antrenează la Bazinul Olimpic produceau N markere suprapuse perfect
 * în același punct. Cu pin picker-ul livrat pe 25.08 s-a agravat: acum toată
 * lumea pinuiește exact aceeași clădire, cu coordonate precise, deci markerele
 * se suprapun la perfecție în loc să fie doar apropiate.
 *
 * Gruparea vizuală (clustering) ar fi rezolvat doar aspectul: la desfacere tot
 * ai fi văzut 50 de pini pe aceeași clădire, iar popup-ul ar fi rămas o listă
 * de rânduri, nu o descriere a locului.
 */

/**
 * Cate zecimale se pastreaza cand se hotaraste ca doua randuri sunt „acelasi loc".
 *
 * Patru zecimale inseamna ~11 metri la latitudinea Timisoarei — adica aceeasi
 * cladire, dar nu si vecina ei. Cinci ar fi ~1 metru: doi oameni care pinuiesc
 * aceeasi intrare de la doua telefoane n-ar mai nimeri acelasi loc. Trei ar fi
 * ~111 metri si ar inghiti cladirile de peste drum.
 */
export const ZECIMALE_LOC = 4

export interface Loc {
  /** Cheia locului, din coordonatele rotunjite. Stabilă între randări. */
  cheie: string
  lat: number
  lng: number
  /** Numele cel mai folosit acolo — vezi `numeleLocului`. */
  nume: string
  address: string | null
  city: string | null
  /** Toate rândurile care cad în acest loc, în ordinea primită. */
  randuri: LocationRow[]
  /** Câte cluburi distincte au un rând aici. Rândurile fără club nu se numără. */
  cluburi: number
}

type CuCoordonate = LocationRow & { lat: number; lng: number }

function cheiaLocului(lat: number, lng: number): string {
  return `${lat.toFixed(ZECIMALE_LOC)},${lng.toFixed(ZECIMALE_LOC)}`
}

/**
 * Numele cel mai folosit intr-un loc.
 *
 * Ales de proprietar pe 28.08: parintele recunoaste numele pe care il foloseste
 * lumea, nu pe cel scris primul in baza. La egalitate decide randul cu cele mai
 * multe cursuri — iar daca si acolo e egalitate, ordinea primita, ca rezultatul
 * sa fie acelasi la fiecare randare.
 */
function numeleLocului(randuri: LocationRow[], cursuriPeRand: Map<string, number>): string {
  const scor = new Map<string, { cate: number; cursuri: number; primul: number }>()
  randuri.forEach((r, i) => {
    const nume = r.name.trim()
    const s = scor.get(nume) ?? { cate: 0, cursuri: 0, primul: i }
    s.cate += 1
    s.cursuri += cursuriPeRand.get(r.id) ?? 0
    scor.set(nume, s)
  })

  return [...scor.entries()].sort(
    ([, a], [, b]) => b.cate - a.cate || b.cursuri - a.cursuri || a.primul - b.primul,
  )[0]![0]
}

/**
 * Strange randurile de locatii in locuri, dupa coordonate rotunjite.
 *
 * Randurile fara coordonate sunt lasate afara: harta nu are unde sa le puna.
 * `cursuriPeRand` decide numele la egalitate; fara el, grupurile ies la fel,
 * doar departajarea e mai saraca.
 */
export function grupeazaInLocuri(
  locatii: LocationRow[],
  cursuriPeRand: Map<string, number> = new Map(),
): Loc[] {
  const cuCoordonate = locatii.filter(
    (l): l is CuCoordonate => l.lat != null && l.lng != null,
  )

  const grupuri = new Map<string, CuCoordonate[]>()
  for (const l of cuCoordonate) {
    const cheie = cheiaLocului(l.lat, l.lng)
    const g = grupuri.get(cheie)
    if (g) g.push(l)
    else grupuri.set(cheie, [l])
  }

  return [...grupuri.entries()].map(([cheie, randuri]) => {
    const cluburi = new Set(randuri.map((r) => r.club_id).filter(Boolean))
    return {
      cheie,
      // Coordonatele markerului sunt ale PRIMULUI rand, nu media lor: media ar
      // muta pinul intr-un punct in care nu e nimic, iar diferenta dintre randuri
      // e oricum sub un metru.
      lat: randuri[0]!.lat,
      lng: randuri[0]!.lng,
      nume: numeleLocului(randuri, cursuriPeRand),
      address: randuri.find((r) => r.address)?.address ?? null,
      city: randuri[0]!.city,
      randuri,
      cluburi: cluburi.size,
    }
  })
}

/** Locul care contine randul cerut, pentru `/harta?location=<id>`. */
export function loculRandului(locuri: Loc[], locationId: string): Loc | undefined {
  return locuri.find((loc) => loc.randuri.some((r) => r.id === locationId))
}
