import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'

export type ClubImageKind = 'logo' | 'hero'

const COLUMN = {
  logo: 'logo_storage_path',
  hero: 'hero_photo_storage_path',
} as const

const BUCKET = 'club-assets'

function patch(kind: ClubImageKind, path: string | null) {
  return kind === 'logo' ? { logo_storage_path: path } : { hero_photo_storage_path: path }
}

async function currentPath(clubId: string, kind: ClubImageKind): Promise<string | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select(COLUMN[kind])
    .eq('id', clubId)
    .single()
  if (error) throw error
  return (data as Record<string, string | null>)[COLUMN[kind]] ?? null
}

async function removeQuietly(path: string | null) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

export async function setClubImage(
  clubId: string,
  kind: ClubImageKind,
  file: File,
): Promise<string> {
  if (!esteImagine(file)) throw new Error('Poza trebuie să fie o imagine.')
  const before = await currentPath(clubId, kind)
  const path = `${clubId}/${kind}/${crypto.randomUUID()}.jpg`
  const small = await micsoreazaPoza(file)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, small, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw uploadError
  const { error } = await supabase
    .from('clubs')
    .update(patch(kind, path))
    .eq('id', clubId)
    .select()
    .single()
  if (error) {
    await removeQuietly(path)
    throw error
  }
  if (before !== path) await removeQuietly(before)
  return path
}

export async function clearClubImage(clubId: string, kind: ClubImageKind): Promise<void> {
  const before = await currentPath(clubId, kind)
  const { error } = await supabase
    .from('clubs')
    .update(patch(kind, null))
    .eq('id', clubId)
    .select()
    .single()
  if (error) throw error
  await removeQuietly(before)
}
