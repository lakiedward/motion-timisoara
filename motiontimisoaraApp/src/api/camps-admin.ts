import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

/**
 * Administrarea taberelor, pentru club și pentru antrenor.
 *
 * Separat de `camps.ts`, care servește pagina publică: acolo totul e citire
 * anonimă, aici totul trece prin `pot_administra_tabara`. Formele nu se
 * suprapun aproape deloc.
 */

export type Tabara = Tables<'camps'>
export type CategoriePret = Tables<'camp_price_items'>

/**
 * O categorie așa cum o ține formularul, înainte să capete id și ordine.
 *
 * `type`, nu `interface`, dinadins: parametrul funcției din bază e `Json`, iar
 * TypeScript dă semnătură de index implicită doar aliasurilor de tip. Un
 * `interface` aici s-ar refuza la apel, cu o eroare care nu spune de ce.
 */
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
  location_text: string | null
  capacity: number | null
  allow_cash: boolean
}

export interface Proprietar {
  clubId: string | null
  coachUserId: string | null
}

export interface TabaraDinLista extends Tabara {
  locuriOcupate: number
  categorii: number
  antrenoriAcceptati: number
  antrenoriInAsteptare: number
}

/**
 * Taberele pe care le administrează utilizatorul curent.
 *
 * `camps` e citibilă public, deci filtrul de proprietar trebuie să fie ÎN
 * interogare — RLS nu îl pune, fiindcă n-are de ce: taberele sunt publice.
 */
export async function getTaberelemele(p: Proprietar): Promise<TabaraDinLista[]> {
  if (!p.clubId && !p.coachUserId) return []

  let q = supabase.from('camps').select('*').order('period_start', { ascending: false })
  q = p.clubId ? q.eq('club_id', p.clubId) : q.eq('coach_id', p.coachUserId as string)

  const { data, error } = await q
  if (error) throw error
  const tabere = data ?? []
  if (!tabere.length) return []

  const ids = tabere.map((t) => t.id)
  const [inscrieri, categorii, antrenori] = await Promise.all([
    supabase.from('enrollments').select('entity_id, status').eq('kind', 'CAMP').in('entity_id', ids),
    supabase.from('camp_price_items').select('camp_id').in('camp_id', ids),
    supabase.from('camp_coaches').select('camp_id, status').in('camp_id', ids),
  ])
  if (inscrieri.error) throw inscrieri.error
  if (categorii.error) throw categorii.error
  if (antrenori.error) throw antrenori.error

  const numara = <T>(randuri: T[], cheie: (r: T) => string, pastreaza: (r: T) => boolean = () => true) =>
    randuri.reduce<Record<string, number>>((acc, r) => {
      if (pastreaza(r)) acc[cheie(r)] = (acc[cheie(r)] ?? 0) + 1
      return acc
    }, {})

  // Aceleași două stări pe care le numără și `camp_spots_remaining`: un loc e
  // ocupat de o înscriere plătită sau de una în curs de plată.
  const ocupate = numara(
    inscrieri.data ?? [],
    (r) => r.entity_id,
    (r) => r.status === 'ACTIVE' || r.status === 'PENDING',
  )
  const cat = numara(categorii.data ?? [], (r) => r.camp_id)
  const acceptati = numara(antrenori.data ?? [], (r) => r.camp_id, (r) => r.status === 'accepted')
  const inAsteptare = numara(antrenori.data ?? [], (r) => r.camp_id, (r) => r.status === 'invited')

  return tabere.map((t) => ({
    ...t,
    locuriOcupate: ocupate[t.id] ?? 0,
    categorii: cat[t.id] ?? 0,
    antrenoriAcceptati: acceptati[t.id] ?? 0,
    antrenoriInAsteptare: inAsteptare[t.id] ?? 0,
  }))
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

/**
 * `.select().single()` peste tot: fără el, un refuz al RLS se întoarce ca 204 cu
 * zero rânduri, adică *exact* ca o reușită. Aceeași capcană a fost reparată pe
 * anunțurile clubului.
 */
export async function creeazaTabara(p: Proprietar, input: TabaraInput): Promise<Tabara> {
  const { data, error } = await supabase
    .from('camps')
    .insert({
      ...input,
      club_id: p.clubId,
      coach_id: p.clubId ? null : p.coachUserId,
      price: 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizeazaTabara(id: string, input: TabaraInput): Promise<Tabara> {
  const { data, error } = await supabase.from('camps').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function stergeTabara(id: string): Promise<void> {
  const { error } = await supabase.from('camps').delete().eq('id', id).select().single()
  if (error) throw error
}

/**
 * Prețul și desfășurarea lui se scriu ÎMPREUNĂ, printr-o funcție.
 *
 * Nu din comoditate: invariantul e între ele, deci două cereri separate ar avea
 * între ele o clipă în care nu se potrivesc — iar triggerul din bază refuză
 * exact acea clipă. Funcția le pune în aceeași tranzacție și refuză o
 * desfășurare care nu dă prețul, oricine ar chema-o.
 */
export async function salveazaBanii(
  campId: string,
  pret: number,
  categorii: CategorieDeSalvat[],
): Promise<CategoriePret[]> {
  const { data, error } = await supabase.rpc('salveaza_banii_taberei', {
    p_camp_id: campId,
    p_price: pret,
    p_categorii: categorii,
  })
  if (error) throw error
  return data ?? []
}

/** Suma categoriilor, în bani. Aceeași socoteală ca poarta din bază. */
export function sumaCategoriilor(categorii: { amount: number }[]): number {
  return categorii.reduce((t, c) => t + (Number.isFinite(c.amount) ? c.amount : 0), 0)
}

/** Slug din titlu: litere mici, fără diacritice, cratime în loc de spații. */
export function slugDinTitlu(titlu: string): string {
  return (
    titlu
      // ș și ț au două forme în Unicode (cu virgulă și cu sedilă) și niciuna nu
      // se descompune prin NFD, deci se scot pe nume.
      .replace(/[șşȘŞ]/g, 's')
      .replace(/[țţȚŢ]/g, 't')
      .normalize('NFD')
      // Semnele combinate rămase după NFD: ă, â, î și restul. Intervalul e
      // U+0300–U+036F, scris aici cu caracterele lui, care sunt invizibile —
      // dacă linia asta pare goală într-un editor, nu e: are testul ei în
      // camps-admin.test.ts, deci o ștergere accidentală se vede imediat.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      // Tăierea la 60 poate lăsa o cratimă la coadă.
      .replace(/-+$/, '')
  )
}
