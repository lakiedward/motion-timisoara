import { supabase } from '@/lib/supabase'
import { esteImagine, micsoreazaPoza } from '@/lib/media'

const BUCKET = 'coach-photos'

async function uid(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

async function currentPath(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('photo_storage_path')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.photo_storage_path ?? null
}

async function removeQuietly(path: string | null) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

async function savePath(userId: string, path: string | null) {
  const { data, error } = await supabase
    .from('coach_profiles')
    .update({ photo_storage_path: path })
    .eq('user_id', userId)
    .select('id')
  if (error) throw error
  if (data?.length) return
  const { error: insertError } = await supabase
    .from('coach_profiles')
    .insert({ user_id: userId, photo_storage_path: path })
  if (insertError) throw insertError
}

export async function getMyCoachPhotoPath(): Promise<string | null> {
  return currentPath(await uid())
}

export async function setMyCoachPhoto(file: File): Promise<string> {
  if (!esteImagine(file)) throw new Error('Poza trebuie să fie o imagine.')
  const userId = await uid()
  const before = await currentPath(userId)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const small = await micsoreazaPoza(file)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, small, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw uploadError
  try {
    await savePath(userId, path)
  } catch (error) {
    await removeQuietly(path)
    throw error
  }
  if (before !== path) await removeQuietly(before)
  return path
}

export async function clearMyCoachPhoto(): Promise<void> {
  const userId = await uid()
  const before = await currentPath(userId)
  if (!before) return
  await savePath(userId, null)
  await removeQuietly(before)
}
