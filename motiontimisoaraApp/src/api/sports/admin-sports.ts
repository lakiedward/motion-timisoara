import { supabase } from '@/lib/supabase'
import { esteImagine } from '@/lib/media'

export class SportMutationError extends Error {}

export class SportPhotoSaveError extends SportMutationError {}

export interface SportPhotoResult {
  path: string | null
  warning: string | null
}

export function normalizeSportCode(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function sportNameError(name: string): string | null {
  if (name.trim().length < 2) return 'Numele sportului trebuie să aibă minimum două caractere.'
  if (!normalizeSportCode(name))
    return 'Numele sportului trebuie să conțină cel puțin o literă sau o cifră.'
  return null
}

export function sportErrorMessage(error: unknown, fallback: string) {
  return error instanceof SportMutationError ? error.message : fallback
}

export async function createSport(code: string, name: string) {
  const invalid = sportNameError(name)
  if (invalid) throw new SportMutationError(invalid)
  const normalized = normalizeSportCode(name)
  if (code !== normalized) throw new SportMutationError('Codul sportului nu corespunde numelui.')
  const { error } = await supabase.from('sports').insert({ code: normalized, name: name.trim() })
  if (error?.code === '23505')
    throw new SportMutationError(
      'Există deja un sport cu acest cod. Alege un nume care produce un cod diferit.',
    )
  if (error) throw error
}

export async function updateSport(id: string, code: string, name: string) {
  const { error } = await supabase
    .from('sports')
    .update({ code, name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export async function deleteSport(id: string) {
  const { error } = await supabase.from('sports').delete().eq('id', id).select().single()
  if (error?.code === '23503')
    throw new SportMutationError(
      'Sportul este folosit de cursuri, activități, antrenori sau cluburi și nu poate fi șters.',
    )
  if (error) throw error
}

async function readPhotoPath(sportId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sports')
    .select('default_photo_storage_path')
    .eq('id', sportId)
    .single()
  if (error) throw error
  return data.default_photo_storage_path
}

async function savePhotoPath(sportId: string, previous: string | null, path: string | null) {
  let update = supabase
    .from('sports')
    .update({ default_photo_storage_path: path })
    .eq('id', sportId)
  update =
    previous === null
      ? update.is('default_photo_storage_path', null)
      : update.eq('default_photo_storage_path', previous)
  const { error } = await update.select().single()
  if (error) throw error
}

async function removePreviousPhoto(sportId: string, path: string | null): Promise<boolean> {
  if (!path?.startsWith(`${sportId}/`)) return true
  try {
    const { error } = await supabase.storage.from('sport-photos').remove([path])
    return !error
  } catch {
    return false
  }
}

export async function setSportDefaultPhoto(sportId: string, file: File): Promise<SportPhotoResult> {
  if (!esteImagine(file) || file.size === 0)
    throw new SportMutationError('Alege un fișier imagine care nu este gol.')
  const previous = await readPhotoPath(sportId)
  const ext =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${sportId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('sport-photos').upload(path, file, {
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw uploadError
  try {
    await savePhotoPath(sportId, previous, path)
  } catch {
    throw new SportPhotoSaveError(
      'Fotografia a fost încărcată în Storage, dar salvarea asocierii nu a fost confirmată. Fișierul încărcat a fost păstrat; reîncarcă lista înainte de a reîncerca.',
    )
  }
  const removed = await removePreviousPhoto(sportId, previous)
  return {
    path,
    warning: removed
      ? null
      : 'Noua poză este salvată, dar fișierul vechi nu a putut fi eliminat din Storage.',
  }
}

export async function clearSportDefaultPhoto(sportId: string): Promise<SportPhotoResult> {
  const previous = await readPhotoPath(sportId)
  await savePhotoPath(sportId, previous, null)
  const removed = await removePreviousPhoto(sportId, previous)
  return {
    path: null,
    warning: removed
      ? null
      : 'Poza standard a fost scoasă din sport, dar fișierul nu a putut fi eliminat din Storage.',
  }
}
