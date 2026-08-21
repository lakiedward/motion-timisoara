import { supabase } from '@/lib/supabase'

export interface Sport {
  id: string
  code: string
  name: string
  default_photo_storage_path: string | null
}

export async function fetchSports(): Promise<Sport[]> {
  const { data, error } = await supabase
    .from('sports')
    .select('id, code, name, default_photo_storage_path')
    .order('name')
  if (error) throw error
  return data ?? []
}
