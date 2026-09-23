import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'

const BUCKET = 'competition-photos'

export async function schimbaPozaConcurs(id: string, fisier: File): Promise<string> {
  if (!esteImagine(fisier)) throw new Error('Poza trebuie să fie o imagine.')

  const { data: inainte, error: eCitire } = await supabase
    .from('competitions')
    .select('hero_photo_storage_path')
    .eq('id', id)
    .single()
  if (eCitire) throw eCitire

  const cale = `${id}/hero/${crypto.randomUUID()}.jpg`
  const mic = await micsoreazaPoza(fisier)
  const { error: eUrcare } = await supabase.storage
    .from(BUCKET)
    .upload(cale, mic, { contentType: 'image/jpeg', upsert: false })
  if (eUrcare) throw eUrcare

  const { error } = await supabase
    .from('competitions')
    .update({ hero_photo_storage_path: cale })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([cale])
    throw error
  }

  const vechea = inainte?.hero_photo_storage_path
  if (vechea && vechea !== cale) await supabase.storage.from(BUCKET).remove([vechea])
  return cale
}

export async function scoatePozaConcurs(id: string): Promise<void> {
  const { data: inainte, error: eCitire } = await supabase
    .from('competitions')
    .select('hero_photo_storage_path')
    .eq('id', id)
    .single()
  if (eCitire) throw eCitire

  const { error } = await supabase
    .from('competitions')
    .update({ hero_photo_storage_path: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (inainte?.hero_photo_storage_path) {
    await supabase.storage.from(BUCKET).remove([inainte.hero_photo_storage_path])
  }
}
