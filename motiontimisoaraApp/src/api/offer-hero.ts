import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'

type TabelHero = 'activities' | 'courses'

export async function schimbaPozaOferta(
  tabel: TabelHero,
  bucket: 'activity-photos' | 'course-photos',
  id: string,
  fisier: File,
): Promise<string> {
  if (!esteImagine(fisier)) throw new Error('Poza trebuie să fie o imagine.')

  const { data: inainte, error: eCitire } = await supabase
    .from(tabel)
    .select('hero_photo_storage_path')
    .eq('id', id)
    .single()
  if (eCitire) throw eCitire

  const cale = `${id}/hero/${crypto.randomUUID()}.jpg`
  const mic = await micsoreazaPoza(fisier)
  const { error: eUrcare } = await supabase.storage
    .from(bucket)
    .upload(cale, mic, { contentType: 'image/jpeg', upsert: false })
  if (eUrcare) throw eUrcare

  const { error } = await supabase
    .from(tabel)
    .update({ hero_photo_storage_path: cale })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    await supabase.storage.from(bucket).remove([cale])
    throw error
  }

  const vechea = inainte?.hero_photo_storage_path
  if (vechea && vechea !== cale) await supabase.storage.from(bucket).remove([vechea])
  return cale
}

export async function renuntaLaOfertaFaraHero(tabel: TabelHero, id: string): Promise<void> {
  const { error } = await supabase.from(tabel).delete().eq('id', id)
  if (error) throw error
}
