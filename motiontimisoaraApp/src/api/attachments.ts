import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { termenulFilmarii, type FisierPregatit } from '@/lib/media'

const BUCKET = 'announcement-media'
/** Cât ține un link semnat. Scurt: linkul circulă, dreptul nu. */
const VIATA_LINK_SECUNDE = 60 * 60

export type Atasament = Tables<'announcement_attachments'>

/** Un atașament gata de afișat, cu linkul lui semnat. */
export type AtasamentAfisabil = {
  id: string
  fel: 'IMAGE' | 'VIDEO' | 'URL'
  link: string
  contentType: string | null
  /** Când dispare filmarea. Gol pentru poze — ele rămân. */
  expiraLa: string | null
}

function extensia(nume: string, contentType: string): string {
  const dinNume = nume.includes('.') ? nume.split('.').pop()! : ''
  if (dinNume && dinNume.length <= 5) return dinNume.toLowerCase()
  return contentType.split('/')[1] ?? 'bin'
}

/**
 * Urcă fișierele în bucket și le leagă de anunț.
 *
 * Calea e `{announcement_id}/{uuid}.{ext}`, convenție din migrarea 00004: politica
 * de storage citește primul segment ca să afle de care anunț atârnă fișierul, deci
 * anunțul trebuie să existe ÎNAINTE de încărcare. De aceea funcția primește un id,
 * nu creează ea anunțul.
 *
 * Dacă o încărcare pică la mijloc, fișierele deja urcate sunt șterse înapoi:
 * altfel ar rămâne în bucket fără niciun rând care să le pomenească, deci fără
 * nimeni care să le mai poată șterge vreodată.
 */
export async function incarcaAtasamente(
  clubAnnouncementId: string,
  fisiere: FisierPregatit[],
): Promise<Atasament[]> {
  if (!fisiere.length) return []
  const urcate: string[] = []

  try {
    const randuri = []
    for (const [i, f] of fisiere.entries()) {
      const cale = `${clubAnnouncementId}/${crypto.randomUUID()}.${extensia(f.numeOriginal, f.contentType)}`
      const { error } = await supabase.storage.from(BUCKET).upload(cale, f.continut, {
        contentType: f.contentType,
        upsert: false,
      })
      if (error) throw error
      urcate.push(cale)
      randuri.push({
        club_announcement_id: clubAnnouncementId,
        type: f.fel,
        storage_path: cale,
        content_type: f.contentType,
        display_order: i,
        expires_at: termenulFilmarii(f.fel),
      })
    }

    const { data, error } = await supabase
      .from('announcement_attachments')
      .insert(randuri)
      .select()
    if (error) throw error
    return data ?? []
  } catch (e) {
    if (urcate.length) await supabase.storage.from(BUCKET).remove(urcate)
    throw e
  }
}

/**
 * Atașamentele mai multor anunțuri, cu linkuri semnate.
 *
 * Bucketul e privat, deci fișierele nu au adresă publică: fiecare are nevoie de un
 * link semnat, cerut într-un singur apel pentru tot lotul. Un link care nu se poate
 * semna e sărit, nu aruncat — un fișier lipsă nu are voie să golească toată galeria.
 */
export async function getAtasamente(
  clubAnnouncementIds: string[],
): Promise<Record<string, AtasamentAfisabil[]>> {
  if (!clubAnnouncementIds.length) return {}
  const { data, error } = await supabase
    .from('announcement_attachments')
    .select('*')
    .in('club_announcement_id', clubAnnouncementIds)
    .order('display_order')
  if (error) throw error

  const randuri = data ?? []
  const cai = randuri.map((r) => r.storage_path).filter((c): c is string => !!c)
  const linkuri = new Map<string, string>()
  if (cai.length) {
    const { data: semnate } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(cai, VIATA_LINK_SECUNDE)
    for (const s of semnate ?? []) {
      if (s.signedUrl && s.path) linkuri.set(s.path, s.signedUrl)
    }
  }

  const pe: Record<string, AtasamentAfisabil[]> = {}
  for (const r of randuri) {
    if (!r.club_announcement_id) continue
    const link = r.storage_path ? linkuri.get(r.storage_path) : r.url
    if (!link) continue
    ;(pe[r.club_announcement_id] ??= []).push({
      id: r.id,
      fel: r.type as AtasamentAfisabil['fel'],
      link,
      contentType: r.content_type,
      expiraLa: r.expires_at,
    })
  }
  return pe
}

/** Scoate un atașament: întâi fișierul, apoi rândul care îl pomenește. */
export async function stergeAtasament(id: string, storagePath: string | null): Promise<void> {
  if (storagePath) {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
    if (error) throw error
  }
  const { error } = await supabase
    .from('announcement_attachments')
    .delete()
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}
