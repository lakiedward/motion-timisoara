import { supabase } from '@/lib/supabase'

export type CursBnr = {
  date: string
  eur_ron_millionths: number
}

export const CURS_BNR_EROARE = 'Nu am putut citi cursul BNR. Reîncearcă.'

export function formatBnrDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}.${month}.${year}`
}

export async function getCursBnr(): Promise<CursBnr> {
  const { data, error } = await supabase.functions.invoke('bnr-rate', { body: {} })
  if (error) throw new Error(CURS_BNR_EROARE)
  if (
    !data ||
    typeof data.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    typeof data.eur_ron_millionths !== 'number' ||
    !Number.isInteger(data.eur_ron_millionths) ||
    data.eur_ron_millionths <= 0
  ) {
    throw new Error(CURS_BNR_EROARE)
  }
  return { date: data.date, eur_ron_millionths: data.eur_ron_millionths }
}
