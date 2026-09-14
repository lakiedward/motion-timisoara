import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { termenulFilmarii, type FisierPregatit } from '@/lib/media'

const BUCKET = 'announcement-media'
const VIATA_LINK_SECUNDE = 60 * 60

export type Atasament = Tables<'announcement_attachments'>
export type AnnouncementAttachmentSource = 'club' | 'coach'

export type AtasamentAfisabil = {
  id: string
  fel: 'IMAGE' | 'VIDEO' | 'URL'
  link: string
  contentType: string | null
  expiraLa: string | null
}

function extensia(nume: string, contentType: string): string {
  const dinNume = nume.includes('.') ? nume.split('.').pop()! : ''
  if (dinNume && dinNume.length <= 5) return dinNume.toLowerCase()
  return contentType.split('/')[1] ?? 'bin'
}

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

    const { data, error } = await supabase.from('announcement_attachments').insert(randuri).select()
    if (error) throw error
    return data ?? []
  } catch (e) {
    if (urcate.length) await supabase.storage.from(BUCKET).remove(urcate)
    throw e
  }
}

export async function getAtasamente(
  announcementIds: string[],
  source: AnnouncementAttachmentSource = 'club',
): Promise<Record<string, AtasamentAfisabil[]>> {
  if (!announcementIds.length) return {}
  const announcementColumn = source === 'club' ? 'club_announcement_id' : 'announcement_id'
  const { data, error } = await supabase
    .from('announcement_attachments')
    .select('*')
    .in(announcementColumn, announcementIds)
    .order('display_order')
  if (error) throw error

  const randuri = data ?? []
  const cai = randuri.map((r) => r.storage_path).filter((c): c is string => !!c)
  const linkuri = new Map<string, string>()
  if (cai.length) {
    const { data: semnate, error: signingError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(cai, VIATA_LINK_SECUNDE)
    if (signingError) throw signingError
    for (const s of semnate ?? []) {
      if (s.signedUrl && s.path) linkuri.set(s.path, s.signedUrl)
    }
  }

  const pe: Record<string, AtasamentAfisabil[]> = {}
  for (const r of randuri) {
    const announcementId = r[announcementColumn]
    if (!announcementId) continue
    const link = r.storage_path ? linkuri.get(r.storage_path) : r.url
    if (!link) continue
    ;(pe[announcementId] ??= []).push({
      id: r.id,
      fel: r.type as AtasamentAfisabil['fel'],
      link,
      contentType: r.content_type,
      expiraLa: r.expires_at,
    })
  }
  return pe
}

export async function stergeFisiereleAnuntului(clubAnnouncementId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('announcement_attachments')
      .select('storage_path')
      .eq('club_announcement_id', clubAnnouncementId)
    const cai = (data ?? []).map((r) => r.storage_path).filter((c): c is string => !!c)
    if (cai.length) await supabase.storage.from(BUCKET).remove(cai)
  } catch {
    return
  }
}

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
