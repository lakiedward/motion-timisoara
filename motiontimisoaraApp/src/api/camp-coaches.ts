import { supabase } from '@/lib/supabase'

/**
 * Antrenorii care însoțesc o tabără.
 *
 * Decis cu proprietarul pe 2026-08-27: oricine poate fi INVITAT, dar apare pe
 * pagina publică abia după ce ACCEPTĂ. Până atunci invitația e o propunere, nu
 * un fapt — altfel un club ar putea pune public numele și poza unui antrenor
 * din alt club, iar acela ar afla ultimul.
 *
 * Proprietarul invită și retrage. Doar antrenorul răspunde, prin funcția
 * `raspunde_invitatie_tabara`: n-are UPDATE pe tabelă deloc, fiindcă o politică
 * l-ar fi lăsat să-și mute invitația pe altă tabără.
 */

export type StareInvitatie = 'invited' | 'accepted' | 'declined'

export interface AntrenorInvitat {
  coachProfileId: string
  nume: string
  pozaUrl: string | null
  stare: StareInvitatie
  raspunsLa: string | null
}

export interface AntrenorGasit {
  coachProfileId: string
  nume: string
  pozaUrl: string | null
}

export interface InvitatieDeRaspuns {
  campId: string
  titlu: string
  slug: string
  perioadaStart: string
  perioadaEnd: string
  loc: string | null
  stare: StareInvitatie
}

const NUME_DE_REZERVA = 'Antrenor'

function pozaUrl(cale: string | null): string | null {
  return cale ? supabase.storage.from('coach-photos').getPublicUrl(cale).data.publicUrl : null
}

/** Toți antrenorii taberei, în orice stare — proprietarul le vede și pe cele în așteptare. */
export async function getAntrenoriiTaberei(campId: string): Promise<AntrenorInvitat[]> {
  const { data, error } = await supabase
    .from('camp_coaches')
    .select(
      'coach_profile_id, status, responded_at, coach_profile:coach_profiles(photo_storage_path, profile:profiles(name))',
    )
    .eq('camp_id', campId)
    .order('invited_at')
  if (error) throw error

  return (data ?? []).map((r) => {
    const cp = r.coach_profile as { photo_storage_path: string | null; profile: { name: string } | null } | null
    return {
      coachProfileId: r.coach_profile_id,
      nume: cp?.profile?.name ?? NUME_DE_REZERVA,
      pozaUrl: pozaUrl(cp?.photo_storage_path ?? null),
      stare: r.status as StareInvitatie,
      raspunsLa: r.responded_at,
    }
  })
}

/**
 * Caută antrenori după nume, ca să poată fi invitați.
 *
 * `coach_profiles` și `profiles` sunt citibile public, deci căutarea nu are
 * nevoie de nimic special — iar faptul că oricine poate fi găsit e tocmai
 * motivul pentru care invitația cere acordul lui.
 */
export async function cautaAntrenori(text: string, exclusi: string[]): Promise<AntrenorGasit[]> {
  const cautat = text.trim()
  if (cautat.length < 2) return []

  const { data, error } = await supabase
    .from('coach_profiles')
    .select('id, photo_storage_path, profile:profiles!inner(name)')
    .ilike('profiles.name', `%${cautat}%`)
    .limit(10)
  if (error) throw error

  return (data ?? [])
    .filter((r) => !exclusi.includes(r.id))
    .map((r) => ({
      coachProfileId: r.id,
      nume: (r.profile as { name: string } | null)?.name ?? NUME_DE_REZERVA,
      pozaUrl: pozaUrl(r.photo_storage_path),
    }))
}

/**
 * `status` nu se trimite: politica de INSERT cere `invited`, iar valoarea
 * implicită a coloanei o pune. Trimițând-o, un client ar putea încerca
 * `accepted` — și ar fi refuzat, corect, dar cu un mesaj de neînțeles.
 */
export async function invitaAntrenor(campId: string, coachProfileId: string): Promise<void> {
  const { error } = await supabase
    .from('camp_coaches')
    .insert({ camp_id: campId, coach_profile_id: coachProfileId })
    .select()
    .single()
  if (error) throw error
}

export async function retrageInvitatia(campId: string, coachProfileId: string): Promise<void> {
  const { error } = await supabase
    .from('camp_coaches')
    .delete()
    .eq('camp_id', campId)
    .eq('coach_profile_id', coachProfileId)
    .select()
    .single()
  if (error) throw error
}

/** Invitațiile antrenorului curent, cu tabăra lor. */
export async function getInvitatiileMele(userId: string): Promise<InvitatieDeRaspuns[]> {
  const { data: profil, error: eProfil } = await supabase
    .from('coach_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (eProfil) throw eProfil
  if (!profil) return []

  const { data, error } = await supabase
    .from('camp_coaches')
    .select('camp_id, status, camp:camps(title, slug, period_start, period_end, location_text)')
    .eq('coach_profile_id', profil.id)
    .order('invited_at', { ascending: false })
  if (error) throw error

  return (data ?? [])
    .map((r) => {
      const c = r.camp as {
        title: string
        slug: string
        period_start: string
        period_end: string
        location_text: string | null
      } | null
      if (!c) return null
      return {
        campId: r.camp_id,
        titlu: c.title,
        slug: c.slug,
        perioadaStart: c.period_start,
        perioadaEnd: c.period_end,
        loc: c.location_text,
        stare: r.status as StareInvitatie,
      }
    })
    .filter((x): x is InvitatieDeRaspuns => x !== null)
}

export async function raspundeInvitatie(campId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('raspunde_invitatie_tabara', {
    p_camp_id: campId,
    p_accept: accept,
  })
  if (error) throw error
}
