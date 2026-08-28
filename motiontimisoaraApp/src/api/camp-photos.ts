import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'
import type { Tables } from '@/lib/database.types'

/**
 * Pozele unei tabere: una mare în cap, restul în galerie.
 *
 * Bucketul `camp-photos` e PUBLIC, ca `course-photos`: paginile de tabere se
 * văd fără cont, deci pozele n-au nevoie de linkuri semnate. Spre deosebire de
 * `announcement-media`, care are poze cu copii la antrenament și e privat — de
 * acolo se împrumută doar micșorarea, nu și felul de a citi.
 */

const BUCKET = 'camp-photos'

/** Câte poze de galerie are voie o tabără. */
export const MAX_POZE_GALERIE = 12

export type PozaTabara = Tables<'camp_photos'>

export interface PozaCuUrl extends PozaTabara {
  url: string
}

export function urlPublic(cale: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(cale).data.publicUrl
}

export async function getPozeleTaberei(campId: string): Promise<PozaCuUrl[]> {
  const { data, error } = await supabase
    .from('camp_photos')
    .select('*')
    .eq('camp_id', campId)
    .order('display_order')
  if (error) throw error
  return (data ?? []).map((p) => ({ ...p, url: urlPublic(p.storage_path) }))
}

function caleNoua(campId: string, sub: 'hero' | 'gallery'): string {
  return `${campId}/${sub}/${crypto.randomUUID()}.jpg`
}

async function urca(cale: string, fisier: File): Promise<void> {
  const mic = await micsoreazaPoza(fisier)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(cale, mic, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

/**
 * Schimbă poza din capul paginii.
 *
 * Fișierul vechi se scoate DUPĂ ce noul e sus și rândul arată spre el: invers,
 * o eroare la urcare ar lăsa tabăra fără poză. Iar dacă ștergerea celui vechi
 * eșuează, nu se pierde nimic — rămâne un fișier nefolosit, pe care îl mătură
 * curățenia nocturnă când tabăra dispare.
 */
export async function schimbaPozaHero(campId: string, fisier: File): Promise<string> {
  if (!esteImagine(fisier)) throw new Error('Poza trebuie să fie o imagine.')

  const { data: inainte, error: eCitire } = await supabase
    .from('camps')
    .select('hero_photo_storage_path')
    .eq('id', campId)
    .single()
  if (eCitire) throw eCitire

  const cale = caleNoua(campId, 'hero')
  await urca(cale, fisier)

  const { error } = await supabase
    .from('camps')
    .update({ hero_photo_storage_path: cale })
    .eq('id', campId)
    .select()
    .single()
  if (error) {
    // Rândul n-a primit calea, deci fișierul urcat acum e orfan din start.
    await supabase.storage.from(BUCKET).remove([cale])
    throw error
  }

  const vechea = inainte?.hero_photo_storage_path
  if (vechea && vechea !== cale) await supabase.storage.from(BUCKET).remove([vechea])
  return cale
}

export async function stergePozaHero(campId: string): Promise<void> {
  const { data: inainte, error: eCitire } = await supabase
    .from('camps')
    .select('hero_photo_storage_path')
    .eq('id', campId)
    .single()
  if (eCitire) throw eCitire

  const { error } = await supabase
    .from('camps')
    .update({ hero_photo_storage_path: null })
    .eq('id', campId)
    .select()
    .single()
  if (error) throw error

  if (inainte?.hero_photo_storage_path) {
    await supabase.storage.from(BUCKET).remove([inainte.hero_photo_storage_path])
  }
}

/**
 * Adaugă poze în galerie, în ordinea în care au fost alese.
 *
 * Întoarce câte au intrat și ce s-a refuzat, cu motive scrise pentru om — un
 * lot pe jumătate reușit e mai bun decât o eroare care nu spune care fișier a
 * fost de vină.
 */
export async function adaugaInGalerie(
  campId: string,
  fisiere: File[],
  cateSunt: number,
): Promise<{ adaugate: number; refuzate: string[] }> {
  const refuzate: string[] = []
  const bune = fisiere.filter((f) => {
    if (!esteImagine(f)) {
      refuzate.push(`${f.name}: nu e o imagine.`)
      return false
    }
    return true
  })

  const loc = Math.max(0, MAX_POZE_GALERIE - cateSunt)
  if (bune.length > loc) {
    for (const f of bune.slice(loc)) {
      refuzate.push(`${f.name}: galeria ține cel mult ${MAX_POZE_GALERIE} poze.`)
    }
  }

  let adaugate = 0
  let ordine = cateSunt
  for (const f of bune.slice(0, loc)) {
    const cale = caleNoua(campId, 'gallery')
    try {
      await urca(cale, f)
      const { error } = await supabase
        .from('camp_photos')
        .insert({ camp_id: campId, storage_path: cale, display_order: ordine })
        .select()
        .single()
      if (error) {
        await supabase.storage.from(BUCKET).remove([cale])
        throw error
      }
      adaugate += 1
      ordine += 1
    } catch {
      refuzate.push(`${f.name}: nu a putut fi urcată.`)
    }
  }

  return { adaugate, refuzate }
}

/** Fișierul întâi, rândul după: invers ar lăsa un fișier pe care nimeni nu-l mai găsește. */
export async function stergeDinGalerie(poza: PozaTabara): Promise<void> {
  const { error: eFisier } = await supabase.storage.from(BUCKET).remove([poza.storage_path])
  if (eFisier) throw eFisier
  const { error } = await supabase.from('camp_photos').delete().eq('id', poza.id).select().single()
  if (error) throw error
}

/**
 * Mută o poză cu un pas, la stânga sau la dreapta.
 *
 * Se schimbă `display_order` între cele două, nu se renumerotează toată galeria:
 * mai puține scrieri, și ordinea rămâne stabilă dacă o cerere pică.
 */
export async function mutaInGalerie(
  poze: PozaTabara[],
  index: number,
  directie: -1 | 1,
): Promise<void> {
  const vecin = index + directie
  if (vecin < 0 || vecin >= poze.length) return
  const a = poze[index]!
  const b = poze[vecin]!

  const { error: e1 } = await supabase
    .from('camp_photos')
    .update({ display_order: b.display_order })
    .eq('id', a.id)
    .select()
    .single()
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('camp_photos')
    .update({ display_order: a.display_order })
    .eq('id', b.id)
    .select()
    .single()
  if (e2) throw e2
}
