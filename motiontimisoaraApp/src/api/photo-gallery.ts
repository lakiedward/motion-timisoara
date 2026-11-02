import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'

export const MAX_POZE_GALERIE = 12
export const MAX_DESCRIERE_POZA = 60

export type TabelGalerie = 'course_photos' | 'camp_photos' | 'activity_photos'

export type GalerieTinta =
  | { tabel: 'course_photos'; bucket: 'course-photos'; parinte: 'course_id'; id: string }
  | { tabel: 'camp_photos'; bucket: 'camp-photos'; parinte: 'camp_id'; id: string }
  | { tabel: 'activity_photos'; bucket: 'activity-photos'; parinte: 'activity_id'; id: string }

export function galerieCurs(id: string): GalerieTinta {
  return { tabel: 'course_photos', bucket: 'course-photos', parinte: 'course_id', id }
}

export function galerieTabara(id: string): GalerieTinta {
  return { tabel: 'camp_photos', bucket: 'camp-photos', parinte: 'camp_id', id }
}

export function galerieActivitate(id: string): GalerieTinta {
  return { tabel: 'activity_photos', bucket: 'activity-photos', parinte: 'activity_id', id }
}

export function galleryQueryKey(tinta: GalerieTinta) {
  return ['poze-galerie', tinta.tabel, tinta.id] as const
}

export type PozaGalerie = {
  id: string
  storage_path: string
  display_order: number
  caption: string | null
  url: string
}

export type PozaPublica = { url: string; caption: string | null }

type RandPoza = Omit<PozaGalerie, 'url'>

export function urlPozaGalerie(bucket: GalerieTinta['bucket'], cale: string): string {
  if (cale.startsWith('http') || cale.startsWith('/')) return cale
  return supabase.storage.from(bucket).getPublicUrl(cale).data.publicUrl
}

export function galeriePublica(
  bucket: GalerieTinta['bucket'],
  poze: Pick<RandPoza, 'storage_path' | 'display_order' | 'caption'>[] | null | undefined,
  caleHero?: string | null,
): PozaPublica[] {
  return [...(poze ?? [])]
    .filter((p) => p.storage_path !== caleHero)
    .sort((a, b) => a.display_order - b.display_order)
    .map((p) => ({
      url: urlPozaGalerie(bucket, p.storage_path),
      caption: p.caption?.trim() || null,
    }))
}

function tabel(t: TabelGalerie) {
  return supabase.from(t as 'camp_photos')
}

export async function getPozeGalerie(tinta: GalerieTinta): Promise<PozaGalerie[]> {
  const { data, error } = await supabase
    .from(tinta.tabel as 'camp_photos')
    .select('id, storage_path, display_order, caption')
    .eq(tinta.parinte as 'camp_id', tinta.id)
    .order('display_order')
  if (error) throw error
  return ((data ?? []) as RandPoza[]).map((p) => ({
    ...p,
    url: urlPozaGalerie(tinta.bucket, p.storage_path),
  }))
}

function randNou(tinta: GalerieTinta, cale: string, ordine: number) {
  const rand: Record<string, unknown> = {
    [tinta.parinte]: tinta.id,
    storage_path: cale,
    display_order: ordine,
    consent_confirmed_at: new Date().toISOString(),
  }
  if (tinta.tabel === 'course_photos') rand.content_type = 'image/jpeg'
  return rand as { camp_id: string; storage_path: string }
}

export async function adaugaPozeGalerie(
  tinta: GalerieTinta,
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
  for (const f of bune.slice(loc)) {
    refuzate.push(`${f.name}: galeria ține cel mult ${MAX_POZE_GALERIE} poze.`)
  }

  let adaugate = 0
  let ordine = cateSunt
  for (const f of bune.slice(0, loc)) {
    const cale = `${tinta.id}/gallery/${crypto.randomUUID()}.jpg`
    try {
      const mic = await micsoreazaPoza(f)
      const { error: eUrcare } = await supabase.storage
        .from(tinta.bucket)
        .upload(cale, mic, { contentType: 'image/jpeg', upsert: false })
      if (eUrcare) throw eUrcare
      const { error } = await tabel(tinta.tabel)
        .insert(randNou(tinta, cale, ordine))
        .select()
        .single()
      if (error) {
        await supabase.storage.from(tinta.bucket).remove([cale])
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

export async function schimbaDescrierePoza(
  tabelGalerie: TabelGalerie,
  id: string,
  descriere: string,
): Promise<void> {
  const curata = descriere.trim().slice(0, MAX_DESCRIERE_POZA)
  const { error } = await tabel(tabelGalerie)
    .update({ caption: curata || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export async function stergePozaGalerie(tinta: GalerieTinta, poza: RandPoza): Promise<void> {
  const { error: eFisier } = await supabase.storage.from(tinta.bucket).remove([poza.storage_path])
  if (eFisier) throw eFisier
  const { error } = await tabel(tinta.tabel).delete().eq('id', poza.id).select().single()
  if (error) throw error
}

export async function mutaPozaGalerie(
  tabelGalerie: TabelGalerie,
  poze: RandPoza[],
  index: number,
  directie: -1 | 1,
): Promise<void> {
  const vecin = index + directie
  if (vecin < 0 || vecin >= poze.length) return
  const a = poze[index]!
  const b = poze[vecin]!

  const { error: e1 } = await tabel(tabelGalerie)
    .update({ display_order: b.display_order })
    .eq('id', a.id)
    .select()
    .single()
  if (e1) throw e1

  const { error: e2 } = await tabel(tabelGalerie)
    .update({ display_order: a.display_order })
    .eq('id', b.id)
    .select()
    .single()
  if (e2) throw e2
}
