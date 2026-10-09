import { z } from 'zod'

export function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function isValidWebsite(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(normalizeWebsite(value))
    return /^https?:$/.test(url.protocol) && /^[^.\s]+(\.[^.\s]+)+$/.test(url.hostname)
  } catch {
    return false
  }
}

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function isValidRomanianIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!iban) return true
  if (!/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function normalizeCui(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function isValidCui(value: string): boolean {
  const cui = normalizeCui(value)
  return !cui || /^(RO)?\d{2,10}$/.test(cui)
}

export const clubProfileSchema = z.object({
  name: z.string().trim().min(2, 'Minim 2 caractere'),
  description: z.string().optional(),
  website: z
    .string()
    .refine(isValidWebsite, 'Introdu un link valid, de exemplu https://clubul-tau.ro'),
  email: z.string().trim().email('Email invalid').or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  public_email_consent: z.boolean(),
  company_name: z.string().optional(),
  company_cui: z.string().refine(isValidCui, 'CUI-ul are doar cifre, cu „RO” opțional în față.'),
  bank_account: z
    .string()
    .refine(
      isValidRomanianIban,
      'Introdu un IBAN românesc valid, de exemplu RO49AAAA1B31007593840000.',
    ),
  bank_name: z.string().optional(),
})

export type ClubProfileValues = z.infer<typeof clubProfileSchema>
