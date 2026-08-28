import { supabase } from '@/lib/supabase'

/**
 * Cine s-a înscris la o tabără.
 *
 * Se vede de proprietar ȘI de antrenorii însoțitori — cerut explicit de
 * proprietar pe 27.08. Ambele drumuri trec prin `pot_vedea_inscrierile_taberei`
 * (migrarea 00028 pentru înscrieri, 00032 pentru fișa copilului), deci pagina
 * asta nu decide nimic despre cine are voie: dacă cineva n-are voie, primește
 * pur și simplu o listă goală de la bază.
 */

export type StareInscriere = 'ACTIVE' | 'PENDING' | 'CANCELLED'

export interface CopilInscris {
  enrollmentId: string
  stare: StareInscriere
  inscrisLa: string
  copilId: string
  nume: string
  dataNasterii: string | null
  marimeTricou: string | null
  alergii: string | null
  contactUrgenta: string | null
  telefonUrgenta: string | null
  contactSecundar: string | null
  telefonSecundar: string | null
}

interface RandCopil {
  id: string
  name: string
  birth_date: string | null
  tshirt_size: string | null
  allergies: string | null
  emergency_contact_name: string | null
  emergency_phone: string | null
  secondary_contact_name: string | null
  secondary_phone: string | null
}

/**
 * Înscrierile anulate nu se arată: locul e liber, iar lista de plecare în tabără
 * n-are ce face cu ele. Cele în curs de plată SE arată, fiindcă țin un loc —
 * aceeași socoteală ca `camp_spots_remaining`.
 */
export async function getInscrisiiTaberei(campId: string): Promise<CopilInscris[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      'id, status, created_at, child_id, child:children(id, name, birth_date, tshirt_size, allergies, emergency_contact_name, emergency_phone, secondary_contact_name, secondary_phone)',
    )
    .eq('kind', 'CAMP')
    .eq('entity_id', campId)
    .in('status', ['ACTIVE', 'PENDING'])
    .order('created_at')
  if (error) throw error

  return (data ?? []).map((r) => {
    const c = r.child as RandCopil | null
    return {
      enrollmentId: r.id,
      stare: r.status as StareInscriere,
      inscrisLa: r.created_at,
      copilId: r.child_id,
      // Fișa poate lipsi dacă politica n-o lasă să treacă. Rândul rămâne, ca
      // numărul de locuri ocupate să fie adevărat — dar spune limpede că nu are
      // cine să-l citească, în loc să arate un nume gol.
      nume: c?.name ?? 'Copil fără fișă vizibilă',
      dataNasterii: c?.birth_date ?? null,
      marimeTricou: c?.tshirt_size ?? null,
      alergii: c?.allergies ?? null,
      contactUrgenta: c?.emergency_contact_name ?? null,
      telefonUrgenta: c?.emergency_phone ?? null,
      contactSecundar: c?.secondary_contact_name ?? null,
      telefonSecundar: c?.secondary_phone ?? null,
    }
  })
}

/** Vârsta împlinită la prima zi a taberei — asta contează pentru grupe, nu cea de azi. */
export function varstaLa(dataNasterii: string | null, ziuaTaberei: string): number | null {
  if (!dataNasterii) return null
  const [an, luna, zi] = dataNasterii.split('-').map(Number)
  const [an2, luna2, zi2] = ziuaTaberei.split('-').map(Number)
  if (!an || !an2) return null
  let varsta = an2 - an
  if (luna2! < luna! || (luna2 === luna && zi2! < zi!)) varsta -= 1
  return varsta >= 0 ? varsta : null
}
