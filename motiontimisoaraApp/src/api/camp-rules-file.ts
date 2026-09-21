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

export function urlRegulamentFisier(cale: string | null | undefined): string | null {
  return publicUrl(CAMP_RULES_FILE_BUCKET, cale)
}

export function campRulesFileAfisabil(row: {
  rules_file_storage_path: string | null
  rules_file_name: string | null
  rules_file_content_type: string | null
  rules_file_size_bytes: number | null
}): CampRulesFileLink | null {
  const meta = campRulesFileFromRow(row)
  const url = urlRegulamentFisier(meta?.storagePath)
  if (!meta || !url) return null
  return { name: meta.name, contentType: meta.contentType, sizeBytes: meta.sizeBytes, url }
}

export async function incarcaRegulamentFisier(campId: string, fisier: File): Promise<CampRulesFileMeta> {
  const refuz = respingeRegulamentFisier(fisier)
  if (refuz) throw new Error(refuz)
  const contentType = campRulesFileContentType(fisier)
  if (!contentType) throw new Error('Fișierul trebuie să fie PDF, imagine, Word sau Excel.')

  const { data: inainte, error: eCitire } = await supabase
    .from('camps')
    .select('rules_file_storage_path')
    .eq('id', campId)
    .single()
  if (eCitire) throw eCitire

  const ext = campRulesFileExtensiePentru(contentType, fisier.name)
  const cale = `${campId}/${crypto.randomUUID()}.${ext}`
  const { error: eUrcare } = await supabase.storage.from(CAMP_RULES_FILE_BUCKET).upload(cale, fisier, {
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

  const { error } = await supabase
    .from('camps')
    .update({
      rules_file_storage_path: meta.storagePath,
      rules_file_name: meta.name,
      rules_file_content_type: meta.contentType,
      rules_file_size_bytes: meta.sizeBytes,
    })
    .eq('id', campId)
    .select()
    .single()
  if (error) {
    await supabase.storage.from(CAMP_RULES_FILE_BUCKET).remove([cale])
    throw error
  }

  const vechea = inainte?.rules_file_storage_path
  if (vechea && vechea !== cale) {
    await supabase.storage.from(CAMP_RULES_FILE_BUCKET).remove([vechea])
  }
  return meta
}

export async function stergeRegulamentFisier(campId: string): Promise<void> {
  const { data: inainte, error: eCitire } = await supabase
    .from('camps')
    .select('rules_file_storage_path')
    .eq('id', campId)
    .single()
  if (eCitire) throw eCitire

  const { error } = await supabase
    .from('camps')
    .update({
      rules_file_storage_path: null,
      rules_file_name: null,
      rules_file_content_type: null,
      rules_file_size_bytes: null,
    })
    .eq('id', campId)
    .select()
    .single()
  if (error) throw error

  if (inainte?.rules_file_storage_path) {
    await supabase.storage.from(CAMP_RULES_FILE_BUCKET).remove([inainte.rules_file_storage_path])
  }
}
