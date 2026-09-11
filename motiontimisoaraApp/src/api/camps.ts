import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { publicUrl } from '@/api/public'
import { getPreturilePeVarsta, type PretPeVarsta } from '@/api/camps-admin'

const BUCKET = 'camp-photos'

export type CampLocation = Pick<
  Tables<'locations'>,
  'id' | 'name' | 'lat' | 'lng' | 'address' | 'city'
>

export type CategoriePret = Pick<
  Tables<'camp_price_items'>,
  'id' | 'name' | 'description' | 'amount' | 'display_order'
>

export type AntrenorTabara = {
  id: string
  nume: string
  pozaUrl: string | null
}

export type OrganizatorTabara = {
  fel: 'club' | 'antrenor'
  nume: string
  link: string
}

export type TabaraDetaliu = {
  tabara: Tables<'camps'>
  location: CampLocation | null
  organizator: OrganizatorTabara | null
  categorii: CategoriePret[]
  agePrices: PretPeVarsta[]
  antrenori: AntrenorTabara[]
  heroUrl: string | null
  galerieUrls: string[]
  locuriRamase: number | null
}

function ziLocala(data: string, ore = 0, minute = 0, secunde = 0, ms = 0): Date {
  const [an, luna, zi] = data.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, zi ?? 1, ore, minute, secunde, ms)
}

export function sAIncheiat(periodEnd: string, azi = new Date()): boolean {
  return ziLocala(periodEnd, 23, 59, 59, 999).getTime() < azi.getTime()
}

export function formatZi(data: string): string {
  return ziLocala(data).toLocaleDateString('ro-RO')
}

export function sumaCategoriilor(categorii: CategoriePret[]): number {
  return categorii.reduce((t, c) => t + Number(c.amount || 0), 0)
}

export type TabaraDinLista = {
  id: string
  slug: string
  title: string
  period_start: string
  period_end: string
  location_text: string | null
  location_id: string | null
  location: CampLocation | null
  price: number
  currency: string
  pricingMode: string
  allow_cash: boolean
  heroUrl: string | null
  organizator: OrganizatorTabara | null
  locuriRamase: number | null
}

export async function getTaberePublice(azi = new Date()): Promise<TabaraDinLista[]> {
  const { data, error } = await supabase
    .from('camps')
    .select(
      '*, club:clubs(id, name), coach:profiles(id, name), location:locations(id, name, lat, lng, address, city)',
    )
    .order('period_start')
  if (error) throw error

  const viitoare = (data ?? []).filter((c) => !sAIncheiat(c.period_end, azi))
  if (!viitoare.length) return []
  const { data: inscrieri, error: eInscrieri } = await supabase
    .from('enrollments')
    .select('entity_id')
    .eq('kind', 'CAMP')
    .in('status', ['ACTIVE', 'PENDING'])
    .in(
      'entity_id',
      viitoare.map((c) => c.id),
    )
  if (eInscrieri) throw eInscrieri

  const ocupate = (inscrieri ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.entity_id] = (acc[r.entity_id] ?? 0) + 1
    return acc
  }, {})

  return viitoare.map((rand) => {
    const { club, coach, location, ...c } = rand as typeof rand & {
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
      location_id: c.location_id ?? null,
      location: location ?? null,
      price: c.price,
      currency: c.currency,
      pricingMode: c.pricing_mode,
      allow_cash: c.allow_cash,
      heroUrl: c.hero_photo_storage_path
        ? supabase.storage.from('camp-photos').getPublicUrl(c.hero_photo_storage_path).data
            .publicUrl
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
    .select(
      '*, club:clubs(id, name), coach:profiles(id, name), location:locations(id, name, lat, lng, address, city)',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!rand) return null

  const { club, coach, location, ...tabara } = rand as typeof rand & {
    club: { id: string; name: string } | null
    coach: { id: string; name: string } | null
  }

  const organizator: OrganizatorTabara | null = club
    ? { fel: 'club', nume: club.name, link: `/cluburi/${club.id}` }
    : coach
      ? { fel: 'antrenor', nume: coach.name, link: `/antrenori/${coach.id}` }
      : null

  const [categorii, antrenori, poze, locuri, agePrices] = await Promise.all([
    supabase
      .from('camp_price_items')
      .select('id, name, description, amount, display_order')
      .eq('camp_id', tabara.id)
      .order('display_order'),
    supabase
      .from('camp_coaches')
      .select('coach_profile:coach_profiles(id, photo_storage_path, profile:profiles(name))')
      .eq('camp_id', tabara.id)
      .eq('status', 'accepted'),
    supabase
      .from('camp_photos')
      .select('storage_path, display_order')
      .eq('camp_id', tabara.id)
      .order('display_order'),
    supabase.rpc('camp_spots_remaining', { p_camp_id: tabara.id }),
    tabara.pricing_mode === 'by_age' ? getPreturilePeVarsta(tabara.id) : Promise.resolve([]),
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
    location: location ?? null,
    organizator,
    categorii: categorii.data ?? [],
    agePrices,
    antrenori: ((antrenori.data ?? []) as unknown as RandAntrenor[])
      .filter((r) => r.coach_profile)
      .map((r) => ({
        id: r.coach_profile!.id,
        nume: r.coach_profile!.profile?.name ?? 'Antrenor',
        pozaUrl: publicUrl('coach-photos', r.coach_profile!.photo_storage_path),
      })),
    heroUrl: publicUrl(BUCKET, tabara.hero_photo_storage_path) ?? galerieUrls[0] ?? null,
    galerieUrls,
    locuriRamase: locuri.data as number | null,
  }
}
