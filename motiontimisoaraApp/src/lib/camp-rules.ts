export const CAMP_RULES_FILE_MAX_BYTES = 10 * 1024 * 1024

export const CAMP_RULES_FILE_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',')

const EXT_TO_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

const TYPE_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const TYPE_ALIAS: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'application/x-pdf': 'application/pdf',
}

export type CampRulesFileMeta = {
  name: string
  contentType: string
  sizeBytes: number
  storagePath: string
}

export type CampRulesFileLink = {
  name: string
  contentType: string
  sizeBytes: number
  url: string
}

export function campRulesForSave(value: string): string | null {
  const text = value.trim()
  return text.length > 0 ? text : null
}

export function campRulesForDisplay(value: string | null | undefined): string | null {
  return campRulesForSave(value ?? '')
}

export function campRulesFileExtensie(nume: string): string {
  const baza = nume.replaceAll('\\', '/').split('/').pop() ?? ''
  const punct = baza.lastIndexOf('.')
  if (punct <= 0 || punct === baza.length - 1) return ''
  return baza.slice(punct + 1).toLowerCase()
}

export function campRulesFileContentType(file: { name: string; type: string }): string | null {
  const dinExt = EXT_TO_TYPE[campRulesFileExtensie(file.name)]
  const brut = (file.type || '').toLowerCase()
  const dinMime = TYPE_ALIAS[brut] ?? (TYPE_TO_EXT[brut] ? brut : null)
  if (dinMime && dinExt && dinMime !== dinExt) return dinExt
  if (dinMime) return dinMime
  return dinExt ?? null
}

export function campRulesFileExtensiePentru(contentType: string, nume: string): string {
  const dinNume = campRulesFileExtensie(nume)
  if (dinNume && EXT_TO_TYPE[dinNume] === contentType) return dinNume
  return TYPE_TO_EXT[contentType] ?? 'bin'
}

export function campRulesFileNumePastrat(nume: string): string {
  const baza = nume.replaceAll('\\', '/').split('/').pop()?.trim() ?? ''
  const curat = [...baza]
    .filter((ch) => ch.charCodeAt(0) > 31 && ch !== '/' && ch !== '\\')
    .join('')
  return curat.slice(0, 255) || 'regulament'
}

export function respingeRegulamentFisier(file: { name: string; type: string; size: number }): string | null {
  if (file.size <= 0) return 'Fișierul este gol.'
  if (file.size > CAMP_RULES_FILE_MAX_BYTES) return 'Fișierul poate avea cel mult 10 MB.'
  if (!campRulesFileContentType(file)) {
    return 'Fișierul trebuie să fie PDF, imagine, Word sau Excel.'
  }
  return null
}

export function campRulesFileKindLabel(contentType: string): string {
  if (contentType === 'application/pdf') return 'PDF'
  if (contentType.startsWith('image/')) return 'Imagine'
  if (contentType.includes('wordprocessingml') || contentType === 'application/msword') return 'Word'
  if (contentType.includes('spreadsheetml') || contentType === 'application/vnd.ms-excel') {
    return 'Excel'
  }
  return 'Document'
}

export function formatCampRulesFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    const n = kb < 10 ? Number(kb.toFixed(1)) : Math.round(kb)
    return `${n.toLocaleString('ro-RO')} KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${Number(mb.toFixed(mb >= 10 ? 0 : 1)).toLocaleString('ro-RO')} MB`
}

export function campRulesFileFromRow(row: {
  rules_file_storage_path: string | null
  rules_file_name: string | null
  rules_file_content_type: string | null
  rules_file_size_bytes: number | null
}): CampRulesFileMeta | null {
  if (
    !row.rules_file_storage_path ||
    !row.rules_file_name ||
    !row.rules_file_content_type ||
    row.rules_file_size_bytes == null
  ) {
    return null
  }
  return {
    storagePath: row.rules_file_storage_path,
    name: row.rules_file_name,
    contentType: row.rules_file_content_type,
    sizeBytes: row.rules_file_size_bytes,
  }
}
