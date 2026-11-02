import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'
import type { Tables } from '@/lib/database.types'

const BUCKET = 'course-photos'

export const MAX_POZE_CURS = 12
export const MAX_DESCRIERE_POZA = 60

export type PozaCurs = Tables<'course_photos'>

export interface PozaCursCuUrl extends PozaCurs {
  url: string
}

export function urlPozaCurs(cale: string): string {
  if (cale.startsWith('http') || cale.startsWith('/')) return cale
  return supabase.storage.from(BUCKET).getPublicUrl(cale).data.publicUrl
}

export function galeriaPublicaCurs(
  poze: Pick<PozaCurs, 'storage_path' | 'display_order' | 'caption'>[] | null | undefined,
  caleHero?: string | null,
): { url: string; caption: string | null }[] {
  return [...(poze ?? [])]
    .filter((p) => p.storage_path !== caleHero)
    .sort((a, b) => a.display_order - b.display_order)
    .map((p) => ({ url: urlPozaCurs(p.storage_path), caption: p.caption?.trim() || null }))
}

export async function getPozeleCursului(courseId: string): Promise<PozaCursCuUrl[]> {
  const { data, error } = await supabase
    .from('course_photos')
    .select('*')
    .eq('course_id', courseId)
    .order('display_order')
  if (error) throw error
  return (data ?? []).map((p) => ({ ...p, url: urlPozaCurs(p.storage_path) }))
}

export async function adaugaPozeCurs(
  courseId: string,
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

  const loc = Math.max(0, MAX_POZE_CURS - cateSunt)
  for (const f of bune.slice(loc)) {
    refuzate.push(`${f.name}: galeria ține cel mult ${MAX_POZE_CURS} poze.`)
  }

  let adaugate = 0
  let ordine = cateSunt
  for (const f of bune.slice(0, loc)) {
    const cale = `${courseId}/gallery/${crypto.randomUUID()}.jpg`
    try {
      const mic = await micsoreazaPoza(f)
      const { error: eUrcare } = await supabase.storage
        .from(BUCKET)
        .upload(cale, mic, { contentType: 'image/jpeg', upsert: false })
      if (eUrcare) throw eUrcare
      const { error } = await supabase
        .from('course_photos')
        .insert({
          course_id: courseId,
          storage_path: cale,
          content_type: 'image/jpeg',
          display_order: ordine,
          consent_confirmed_at: new Date().toISOString(),
        })
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

export async function schimbaDescrierePoza(id: string, descriere: string): Promise<void> {
  const curata = descriere.trim().slice(0, MAX_DESCRIERE_POZA)
  const { error } = await supabase
    .from('course_photos')
    .update({ caption: curata || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export async function stergePozaCurs(poza: PozaCurs): Promise<void> {
  const { error: eFisier } = await supabase.storage.from(BUCKET).remove([poza.storage_path])
  if (eFisier) throw eFisier
  const { error } = await supabase
    .from('course_photos')
    .delete()
    .eq('id', poza.id)
    .select()
    .single()
  if (error) throw error
}

export async function mutaPozaCurs(
  poze: PozaCurs[],
  index: number,
  directie: -1 | 1,
): Promise<void> {
  const vecin = index + directie
  if (vecin < 0 || vecin >= poze.length) return
  const a = poze[index]!
  const b = poze[vecin]!

  const { error: e1 } = await supabase
    .from('course_photos')
    .update({ display_order: b.display_order })
    .eq('id', a.id)
    .select()
    .single()
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('course_photos')
    .update({ display_order: a.display_order })
    .eq('id', b.id)
    .select()
    .single()
  if (e2) throw e2
}
