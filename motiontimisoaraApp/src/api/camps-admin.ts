import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import type { CampRequirementCategory } from '@/lib/camp-requirements'

export type Tabara = Tables<'camps'>
export type CategoriePret = Tables<'camp_price_items'>
export type PretPeVarsta = Tables<'camp_age_prices'>
export type PretAdult = Tables<'camp_adult_prices'>

export type ModPret = 'single' | 'by_age'

export type PretAdultDeSalvat = {
  amount: number
  components: { name: string; amount: number }[]
}

export async function saveCampOffer(
  campId: string,
  amount: number,
  breakdown: CategorieDeSalvat[],
  offer: { currency: 'RON' | 'EUR'; eur_ron_rate_micros: number | null },
  mode: ModPret,
  agePrices: PretPeVarstaDeSalvat[],
  metadata: TabaraInput,
  owner: Proprietar,
  adultPrice: PretAdultDeSalvat,
): Promise<void> {
  const { error } = await supabase.rpc('save_camp_offer', {
    p_camp_id: campId,
    p_metadata: { ...metadata },
    p_club_id: owner.clubId!,
    p_coach_id: (owner.clubId ? null : owner.coachUserId)!,
    p_price: amount,
    p_currency: offer.currency,
    p_eur_ron_rate_micros: offer.eur_ron_rate_micros!,
    p_breakdown: breakdown,
    p_pricing_mode: mode,
    p_age_prices: agePrices,
    p_adult_price: adultPrice,
  })
  if (error) throw error
}

export type PretPeVarstaDeSalvat = {
  age_from: number
  age_to: number
  amount: number
  components: { name: string; amount: number }[]
}

export type CategorieDeSalvat = {
  name: string
  amount: number
  description: string | null
}

export interface TabaraInput {
  title: string
  slug: string
  description: string | null
  period_start: string
  period_end: string

  location_id: string | null
  location_text: string | null
  capacity: number | null
  allow_cash: boolean
  camp_requirements: CampRequirementCategory[]
  rules: string | null
}

export interface Proprietar {
  clubId: string | null
  coachUserId: string | null
}

export interface TabaraDinLista extends Tabara {
  locuriOcupate: number
  categorii: number
  preturiPeVarsta: number[]
  antrenoriAcceptati: number
  antrenoriInAsteptare: number
}

export async function getTaberelemele(p: Proprietar): Promise<TabaraDinLista[]> {
  if (!p.clubId && !p.coachUserId) return []

  let q = supabase.from('camps').select('*').order('period_start', { ascending: false })
  q = p.clubId ? q.eq('club_id', p.clubId) : q.eq('coach_id', p.coachUserId as string)

  const { data, error } = await q
  if (error) throw error
  const tabere = data ?? []
  if (!tabere.length) return []

  const ids = tabere.map((t) => t.id)
  const [inscrieri, categorii, antrenori, varste, adulti] = await Promise.all([
    supabase
      .from('enrollments')
      .select('entity_id, status')
      .eq('kind', 'CAMP')
      .in('entity_id', ids),
    supabase.from('camp_price_items').select('camp_id').in('camp_id', ids),
    supabase.from('camp_coaches').select('camp_id, status').in('camp_id', ids),
    supabase.from('camp_age_prices').select('camp_id, amount').in('camp_id', ids),
    supabase.from('camp_adult_prices').select('camp_id, amount').in('camp_id', ids),
  ])
  if (inscrieri.error) throw inscrieri.error
  if (categorii.error) throw categorii.error
  if (antrenori.error) throw antrenori.error
  if (varste.error) throw varste.error
  if (adulti.error) throw adulti.error

  const numara = <T>(
    randuri: T[],
    cheie: (r: T) => string,
    pastreaza: (r: T) => boolean = () => true,
  ) =>
    randuri.reduce<Record<string, number>>((acc, r) => {
      if (pastreaza(r)) acc[cheie(r)] = (acc[cheie(r)] ?? 0) + 1
      return acc
    }, {})
  const ocupate = numara(
    inscrieri.data ?? [],
    (r) => r.entity_id,
    (r) => r.status === 'ACTIVE' || r.status === 'PENDING',
  )
  const cat = numara(categorii.data ?? [], (r) => r.camp_id)
  const adunaSume = (randuri: { camp_id: string; amount: number | string }[]) =>
    randuri.reduce<Record<string, number[]>>((acc, r) => {
      const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount)
      if (!Number.isFinite(amount)) return acc
      ;(acc[r.camp_id] ??= []).push(amount)
      return acc
    }, {})
  const sumeVarsta = adunaSume(varste.data ?? [])
  const sumeAdult = adunaSume(adulti.data ?? [])
  const acceptati = numara(
    antrenori.data ?? [],
    (r) => r.camp_id,
    (r) => r.status === 'accepted',
  )
  const inAsteptare = numara(
    antrenori.data ?? [],
    (r) => r.camp_id,
    (r) => r.status === 'invited',
  )

  return tabere.map((t) => {
    const peVarsta = t.pricing_mode === 'by_age'
    const sume = [...(sumeVarsta[t.id] ?? []), ...(sumeAdult[t.id] ?? [])]
    return {
      ...t,
      locuriOcupate: ocupate[t.id] ?? 0,
      categorii: peVarsta ? (sumeVarsta[t.id] ?? []).length : (cat[t.id] ?? 0),
      preturiPeVarsta: peVarsta ? sume : [],
      antrenoriAcceptati: acceptati[t.id] ?? 0,
      antrenoriInAsteptare: inAsteptare[t.id] ?? 0,
    }
  })
}

export async function getTabaraDeEditat(id: string): Promise<Tabara | null> {
  const { data, error } = await supabase.from('camps').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function getCategoriile(campId: string): Promise<CategoriePret[]> {
  const { data, error } = await supabase
    .from('camp_price_items')
    .select('*')
    .eq('camp_id', campId)
    .order('display_order')
  if (error) throw error
  return data ?? []
}

export async function stergeTabara(id: string): Promise<void> {
  const { error } = await supabase.from('camps').delete().eq('id', id).select().single()
  if (error) throw error
}

export async function getPreturilePeVarsta(campId: string): Promise<PretPeVarsta[]> {
  const { data, error } = await supabase
    .from('camp_age_prices')
    .select('*')
    .eq('camp_id', campId)
    .order('display_order')
  if (error) throw error
  return data ?? []
}

export async function getPretulAdult(campId: string): Promise<PretAdult | null> {
  const { data, error } = await supabase
    .from('camp_adult_prices')
    .select('*')
    .eq('camp_id', campId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

export function intervaleSuprapuse(
  categorii: { age_from: number; age_to: number }[],
): [number, number] | null {
  for (let i = 0; i < categorii.length; i++) {
    for (let j = i + 1; j < categorii.length; j++) {
      const a = categorii[i]
      const b = categorii[j]
      if (b.age_from <= a.age_to && a.age_from <= b.age_to) return [i, j]
    }
  }
  return null
}

export function sumaCategoriilor(categorii: { amount: number }[]): number {
  return categorii.reduce((t, c) => t + (Number.isFinite(c.amount) ? c.amount : 0), 0)
}

export function slugDinTitlu(titlu: string): string {
  return titlu
    .replace(/[șşȘŞ]/g, 's')
    .replace(/[țţȚŢ]/g, 't')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}
