import { TERMS_VERSION } from '@/features/public/terms/terms-sections'

export { TERMS_VERSION }

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function rulesFingerprint(
  filePath: string | null | undefined,
  text: string | null | undefined,
): Promise<string> {
  if (filePath) return `file:${filePath}`
  const trimmed = text?.trim()
  if (trimmed) return `text:${await sha256Hex(trimmed)}`
  return 'none'
}

export function termsTextForHash(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function acceptanceResetCode(code: string | undefined): boolean {
  return code === 'PRICE_CHANGED' || code === 'RULES_CHANGED' || code === 'TERMS_CHANGED'
}
