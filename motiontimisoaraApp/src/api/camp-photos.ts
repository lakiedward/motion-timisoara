import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'

const BUCKET = 'camp-photos'

export function urlPublic(cale: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(cale).data.publicUrl
}

function caleNoua(campId: string, sub: 'hero'): string {
  return `${campId}/${sub}/${crypto.randomUUID()}.jpg`
}

async function urca(cale: string, fisier: File): Promise<void> {
  const mic = await micsoreazaPoza(fisier)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(cale, mic, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

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
