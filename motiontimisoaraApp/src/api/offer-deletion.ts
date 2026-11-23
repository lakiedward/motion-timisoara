import { supabase } from '@/lib/supabase'

export type OfferTable = 'courses' | 'activities' | 'camps' | 'competitions'

export async function deleteOffer(table: OfferTable, id: string): Promise<void> {
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id').maybeSingle()
  if (error?.code === '23503') {
    const advice = table === 'courses' || table === 'activities' ? ' O poți dezactiva din listă.' : ''
    throw new Error(`Oferta are înscrieri, prezențe sau rezultate salvate.${advice}`)
  }
  if (error?.code === '42501' || (!error && !data)) {
    throw new Error('Oferta nu mai este disponibilă sau nu ai permisiunea să o ștergi.')
  }
  if (error) throw new Error('Ștergerea a eșuat. Încearcă din nou.')
}
