import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { publicUrl } from '@/api/public'

const BUCKET = 'camp-photos'

export type CategoriePret = Pick<
  Tables<'camp_price_items'>,
  'id' | 'name' | 'description' | 'amount' | 'display_order'
>

export type AntrenorTabara = {
  id: string
  nume: string
  pozaUrl: string | null
}

/**
 * Cine răspunde de tabără: clubul sau antrenorul care a făcut-o.
 *
 * `null` doar pentru taberele vechi, dinainte de migrarea 00025, care n-au niciun
 * proprietar — constrângerea e `NOT VALID`, deci ele rămân așa.
 */
export type OrganizatorTabara = {
  fel: 'club' | 'antrenor'
  nume: string
  /** `/cluburi/:id` ia id-ul clubului; `/antrenori/:id` ia user_id-ul. */
  link: string
}

/** O tabără cu tot ce se arată pe pagina ei publică. */
export type TabaraDetaliu = {
  tabara: Tables<'camps'>
  organizator: OrganizatorTabara | null
  categorii: CategoriePret[]
  antrenori: AntrenorTabara[]
  /** Poza mare din cap, sau prima din galerie dacă nu s-a ales una. */
  heroUrl: string | null
  galerieUrls: string[]
  /** Locuri rămase. `null` = capacitate nelimitată, nu zero. */
  locuriRamase: number | null
}

/**
 * O zi calendaristică din baza de date, citită în fusul celui care se uită.
 *
 * `new Date('2026-09-18')` se interpretează ca miezul nopții UTC, nu local. La
 * vest de Greenwich asta cade în ziua precedentă, deci o tabără care ține până pe
 * 18 septembrie apărea încheiată încă din 17, iar înscrierile se închideau cu o zi
 * mai devreme pentru un părinte din diaspora. Datele astea sunt zile de calendar,
 * nu momente, deci se construiesc din bucăți.
 */
function ziLocala(data: string, ore = 0, minute = 0, secunde = 0, ms = 0): Date {
  const [an, luna, zi] = data.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, zi ?? 1, ore, minute, secunde, ms)
}

/** Ziua de final se numără întreagă: pe 18 septembrie tabăra încă nu s-a încheiat. */
export function sAIncheiat(periodEnd: string, azi = new Date()): boolean {
  return ziLocala(periodEnd, 23, 59, 59, 999).getTime() < azi.getTime()
}

/** „13.09.2026”, din ziua de calendar, nu din momentul UTC. */
export function formatZi(data: string): string {
  return ziLocala(data).toLocaleDateString('ro-RO')
}

/** Suma categoriilor, în bani. Trebuie să dea prețul taberei. */
export function sumaCategoriilor(categorii: CategoriePret[]): number {
  return categorii.reduce((t, c) => t + Number(c.amount || 0), 0)
}

/**
 * Tot ce trebuie pentru pagina unei tabere, într-o singură trecere.
 *
 * Aruncă la eșec în loc să întoarcă `null`, spre deosebire de `getCampBySlug`
 * din `api/public.ts`: pagina trebuie să deosebească „tabăra nu există" de „n-am
 * putut încărca", iar un `null` pentru amândouă le confundă. Tabăra lipsă vine
 * ca `null` doar din `maybeSingle`, adică din zero rânduri.
 */
/** O tabără așa cum apare în lista publică. */
export type TabaraDinLista = {
  id: string
  slug: string
  title: string
  period_start: string
  period_end: string
  location_text: string | null
  price: number
  allow_cash: boolean
  heroUrl: string | null
  organizator: OrganizatorTabara | null
  /** `null` = fără limită de locuri. */
  locuriRamase: number | null
}

/**
 * Taberele pentru pagina publică `/tabere`.
 *
 * Arată DOAR pe cele care nu s-au încheiat, cea mai apropiată prima. Decis cu
 * proprietarul pe 28.08. Până acum lista cerea tot, ordonat după `period_start`
 * crescător — deci taberele trecute urcau deasupra celor viitoare, sub un titlu
 * care scrie „VACANȚE ACTIVE". Paginile lor rămân accesibile pe link direct,
 * unde badge-ul „Încheiată" spune adevărul.
 *
 * Filtrul se face în JS, nu în interogare: „încheiată" înseamnă sfârșitul zilei
 * de final în fusul CITITORULUI, iar `sAIncheiat` știe asta. Un `gte` pe dată ar
 * fi tăiat după miezul nopții UTC și ar fi ascuns o tabără cu o zi mai devreme
 * pentru cine e la vest de Greenwich.
 */
export async function getTaberePublice(azi = new Date()): Promise<TabaraDinLista[]> {
  const { data, error } = await supabase
    .from('camps')
    .select('*, club:clubs(id, name), coach:profiles(id, name)')
    .order('period_start')
  if (error) throw error

  const viitoare = (data ?? []).filter((c) => !sAIncheiat(c.period_end, azi))
  if (!viitoare.length) return []

  // Un singur apel pentru toate taberele, nu `camp_spots_remaining` de N ori.
  // Aceleași două stări pe care le numără și funcția din bază: un loc e ocupat
  // de o înscriere plătită sau de una în curs de plată.
  const { data: inscrieri, error: eInscrieri } = await supabase
    .from('enrollments')
    .select('entity_id')
    .eq('kind', 'CAMP')
    .in('status', ['ACTIVE', 'PENDING'])
    .in('entity_id', viitoare.map((c) => c.id))
  if (eInscrieri) throw eInscrieri

  const ocupate = (inscrieri ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.entity_id] = (acc[r.entity_id] ?? 0) + 1
    return acc
  }, {})

  return viitoare.map((rand) => {
    const { club, coach, ...c } = rand as typeof rand & {
      club: { id: string; name: string } | null
      coach: { id: string; name: string } | null
    }
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      period_start: c.period_start,
      period_end: c.period_end,
      location_text: c.location_text,
      price: c.price,
      allow_cash: c.allow_cash,
      heroUrl: c.hero_photo_storage_path
        ? supabase.storage.from('camp-photos').getPublicUrl(c.hero_photo_storage_path).data.publicUrl
        : null,
      organizator: club
        ? { fel: 'club', nume: club.name, link: `/cluburi/${club.id}` }
        : coach
          ? { fel: 'antrenor', nume: coach.name, link: `/antrenori/${coach.id}` }
          : null,
      locuriRamase: c.capacity === null ? null : Math.max(0, c.capacity - (ocupate[c.id] ?? 0)),
    }
  })
}

export async function getTabaraDetaliu(slug: string): Promise<TabaraDetaliu | null> {
  const { data: rand, error } = await supabase
    .from('camps')
    .select('*, club:clubs(id, name), coach:profiles(id, name)')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!rand) return null

  const { club, coach, ...tabara } = rand as typeof rand & {
    club: { id: string; name: string } | null
    coach: { id: string; name: string } | null
  }

  const organizator: OrganizatorTabara | null = club
    ? { fel: 'club', nume: club.name, link: `/cluburi/${club.id}` }
    : coach
      ? { fel: 'antrenor', nume: coach.name, link: `/antrenori/${coach.id}` }
      : null

  const [categorii, antrenori, poze, locuri] = await Promise.all([
    supabase
      .from('camp_price_items')
      .select('id, name, description, amount, display_order')
      .eq('camp_id', tabara.id)
      .order('display_order'),
    supabase
      .from('camp_coaches')
      .select('coach_profile:coach_profiles(id, photo_storage_path, profile:profiles(name))')
      .eq('camp_id', tabara.id)
      // Filtrul e AICI, nu doar în RLS. Politica lasă proprietarul să-și vadă și
      // invitațiile în așteptare, ca să le administreze — dar pagina publică
      // trebuie să arate la fel pentru toată lumea. Fără linia asta, clubul ar
      // vedea pe propria pagină antrenori pe care părinții nu-i văd.
      .eq('status', 'accepted'),
    supabase
      .from('camp_photos')
      .select('storage_path, display_order')
      .eq('camp_id', tabara.id)
      .order('display_order'),
    supabase.rpc('camp_spots_remaining', { p_camp_id: tabara.id }),
  ])

  if (categorii.error) throw categorii.error
  if (antrenori.error) throw antrenori.error
  if (poze.error) throw poze.error
  if (locuri.error) throw locuri.error

  type RandAntrenor = {
    coach_profile: {
      id: string
      photo_storage_path: string | null
      profile: { name: string } | null
    } | null
  }

  const galerieUrls = (poze.data ?? [])
    .map((p) => publicUrl(BUCKET, p.storage_path))
    .filter((u): u is string => !!u)

  return {
    tabara,
    organizator,
    categorii: categorii.data ?? [],
    antrenori: ((antrenori.data ?? []) as unknown as RandAntrenor[])
      .filter((r) => r.coach_profile)
      .map((r) => ({
        id: r.coach_profile!.id,
        nume: r.coach_profile!.profile?.name ?? 'Antrenor',
        pozaUrl: publicUrl('coach-photos', r.coach_profile!.photo_storage_path),
      })),
    // Fără poză aleasă, prima din galerie ține locul: mai bine o poză din tabără
    // decât un fond gol în capul paginii.
    heroUrl: publicUrl(BUCKET, tabara.hero_photo_storage_path) ?? galerieUrls[0] ?? null,
    galerieUrls,
    locuriRamase: locuri.data as number | null,
  }
}
