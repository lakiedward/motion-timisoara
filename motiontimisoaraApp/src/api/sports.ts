import { supabase } from '@/lib/supabase'

export interface Sport {
  id: string
  code: string
  name: string
}

export async function fetchSports(): Promise<Sport[]> {
  const { data, error } = await supabase.from('sports').select('id, code, name').order('name')
  if (error) throw error
  return data ?? []
}
