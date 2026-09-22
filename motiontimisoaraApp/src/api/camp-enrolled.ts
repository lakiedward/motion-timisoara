import { supabase } from '@/lib/supabase'

export type StareInscriere = 'ACTIVE' | 'PENDING' | 'CANCELLED'

export type FelParticipant = 'child' | 'adult'

export interface CopilInscris {
  enrollmentId: string
  stare: StareInscriere
  inscrisLa: string
  fel: FelParticipant
  copilId: string | null
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

interface RandAdult {
  id: string
  name: string | null
}

export async function getInscrisiiTaberei(campId: string): Promise<CopilInscris[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      'id, status, created_at, child_id, adult_profile_id, child:children(id, name, birth_date, tshirt_size, allergies, emergency_contact_name, emergency_phone, secondary_contact_name, secondary_phone), adult:profiles!enrollments_adult_profile_id_fkey(id, name)',
    )
    .eq('kind', 'CAMP')
    .eq('entity_id', campId)
    .in('status', ['ACTIVE', 'PENDING'])
    .order('created_at')
  if (error) throw error

  return (data ?? []).map((r) => {
    const adult = (r as { adult?: RandAdult | null }).adult
    if (r.adult_profile_id) {
      return {
        enrollmentId: r.id,
        stare: r.status as StareInscriere,
        inscrisLa: r.created_at,
        fel: 'adult',
        copilId: null,
        nume: adult?.name?.trim() || 'Adult fără nume vizibil',
        dataNasterii: null,
        marimeTricou: null,
        alergii: null,
        contactUrgenta: null,
        telefonUrgenta: null,
        contactSecundar: null,
        telefonSecundar: null,
      }
    }
    const c = r.child as RandCopil | null
    return {
      enrollmentId: r.id,
      stare: r.status as StareInscriere,
      inscrisLa: r.created_at,
      fel: 'child',
      copilId: r.child_id,
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

export function varstaLa(dataNasterii: string | null, ziuaTaberei: string): number | null {
  if (!dataNasterii) return null
  const [an, luna, zi] = dataNasterii.split('-').map(Number)
  const [an2, luna2, zi2] = ziuaTaberei.split('-').map(Number)
  if (!an || !an2) return null
  let varsta = an2 - an
  if (luna2! < luna! || (luna2 === luna && zi2! < zi!)) varsta -= 1
  return varsta >= 0 ? varsta : null
}
