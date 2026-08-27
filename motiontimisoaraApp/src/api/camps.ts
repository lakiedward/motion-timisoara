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

/** O tabără cu tot ce se arată pe pagina ei publică. */
export type TabaraDetaliu = {
  tabara: Tables<'camps'>
  categorii: CategoriePret[]
  antrenori: AntrenorTabara[]
  /** Poza mare din cap, sau prima din galerie dacă nu s-a ales una. */
  heroUrl: string | null
  galerieUrls: string[]
  /** Locuri rămase. `null` = capacitate nelimitată, nu zero. */
  locuriRamase: number | null
}

/** O tabără s-a încheiat când ultima ei zi a trecut. Ziua de final se numără. */
export function sAIncheiat(periodEnd: string, azi = new Date()): boolean {
  const sfarsit = new Date(periodEnd)
  sfarsit.setHours(23, 59, 59, 999)
  return sfarsit.getTime() < azi.getTime()
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
export async function getTabaraDetaliu(slug: string): Promise<TabaraDetaliu | null> {
  const { data: tabara, error } = await supabase
    .from('camps')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!tabara) return null

  const [categorii, antrenori, poze, locuri] = await Promise.all([
    supabase
      .from('camp_price_items')
      .select('id, name, description, amount, display_order')
      .eq('camp_id', tabara.id)
      .order('display_order'),
    supabase
      .from('camp_coaches')
      .select('coach_profile:coach_profiles(id, photo_storage_path, profile:profiles(name))')
      .eq('camp_id', tabara.id),
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
