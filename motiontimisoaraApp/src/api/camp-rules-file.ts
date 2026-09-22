import { supabase } from '@/lib/supabase'
import { publicUrl } from '@/api/public'
import {
  campRulesFileContentType,
  campRulesFileExtensiePentru,
  campRulesFileFromRow,
  campRulesFileNumePastrat,
  respingeRegulamentFisier,
  type CampRulesFileLink,
  type CampRulesFileMeta,
} from '@/lib/camp-rules'

export const CAMP_RULES_FILE_BUCKET = 'camp-rules'
export const COURSE_RULES_FILE_BUCKET = 'course-rules'
export const ACTIVITY_RULES_FILE_BUCKET = 'activity-rules'

type OfertaRegulament = 'camps' | 'courses' | 'activities'

export function urlRegulamentFisier(cale: string | null | undefined): string | null {
  return publicUrl(CAMP_RULES_FILE_BUCKET, cale)
}

export function rulesFileAfisabil(
  bucket: string,
  row: {
    rules_file_storage_path: string | null
    rules_file_name: string | null
    rules_file_content_type: string | null
    rules_file_size_bytes: number | null
  },
): CampRulesFileLink | null {
  const meta = campRulesFileFromRow(row)
  const url = publicUrl(bucket, meta?.storagePath)
  if (!meta || !url) return null
  return { name: meta.name, contentType: meta.contentType, sizeBytes: meta.sizeBytes, url }
}

export function campRulesFileAfisabil(row: {
  rules_file_storage_path: string | null
  rules_file_name: string | null
  rules_file_content_type: string | null
  rules_file_size_bytes: number | null
}): CampRulesFileLink | null {
  return rulesFileAfisabil(CAMP_RULES_FILE_BUCKET, row)
}

async function citesteCale(table: OfertaRegulament, id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select('rules_file_storage_path')
    .eq('id', id)
    .single()
  if (error) throw error
  return data.rules_file_storage_path
}

async function scrieFisier(
  table: OfertaRegulament,
  id: string,
  meta: CampRulesFileMeta | null,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update(
      meta
        ? {
            rules_file_storage_path: meta.storagePath,
            rules_file_name: meta.name,
            rules_file_content_type: meta.contentType,
            rules_file_size_bytes: meta.sizeBytes,
          }
        : {
            rules_file_storage_path: null,
            rules_file_name: null,
            rules_file_content_type: null,
            rules_file_size_bytes: null,
          },
    )
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export async function incarcaFisierRegulament(
  table: OfertaRegulament,
  bucket: string,
  id: string,
  fisier: File,
): Promise<CampRulesFileMeta> {
  const refuz = respingeRegulamentFisier(fisier)
  if (refuz) throw new Error(refuz)
  const contentType = campRulesFileContentType(fisier)
  if (!contentType) throw new Error('Fișierul trebuie să fie PDF, imagine, Word sau Excel.')

  const vechea = await citesteCale(table, id)
  const ext = campRulesFileExtensiePentru(contentType, fisier.name)
  const cale = `${id}/${crypto.randomUUID()}.${ext}`
  const { error: eUrcare } = await supabase.storage.from(bucket).upload(cale, fisier, {
    contentType,
    upsert: false,
  })
  if (eUrcare) throw eUrcare

  const meta: CampRulesFileMeta = {
    storagePath: cale,
    name: campRulesFileNumePastrat(fisier.name),
    contentType,
    sizeBytes: fisier.size,
  }

  try {
    await scrieFisier(table, id, meta)
  } catch (error) {
    await supabase.storage.from(bucket).remove([cale])
    throw error
  }

  if (vechea && vechea !== cale) {
    await supabase.storage.from(bucket).remove([vechea])
  }
  return meta
}

export async function stergeFisierRegulament(
  table: OfertaRegulament,
  bucket: string,
  id: string,
): Promise<void> {
  const vechea = await citesteCale(table, id)
  await scrieFisier(table, id, null)
  if (vechea) await supabase.storage.from(bucket).remove([vechea])
}

export function incarcaRegulamentFisier(campId: string, fisier: File): Promise<CampRulesFileMeta> {
  return incarcaFisierRegulament('camps', CAMP_RULES_FILE_BUCKET, campId, fisier)
}

export function stergeRegulamentFisier(campId: string): Promise<void> {
  return stergeFisierRegulament('camps', CAMP_RULES_FILE_BUCKET, campId)
}

export function incarcaRegulamentCurs(courseId: string, fisier: File): Promise<CampRulesFileMeta> {
  return incarcaFisierRegulament('courses', COURSE_RULES_FILE_BUCKET, courseId, fisier)
}

export function stergeRegulamentCurs(courseId: string): Promise<void> {
  return stergeFisierRegulament('courses', COURSE_RULES_FILE_BUCKET, courseId)
}

export function incarcaRegulamentActivitate(
  activityId: string,
  fisier: File,
): Promise<CampRulesFileMeta> {
  return incarcaFisierRegulament('activities', ACTIVITY_RULES_FILE_BUCKET, activityId, fisier)
}

export function stergeRegulamentActivitate(activityId: string): Promise<void> {
  return stergeFisierRegulament('activities', ACTIVITY_RULES_FILE_BUCKET, activityId)
}
