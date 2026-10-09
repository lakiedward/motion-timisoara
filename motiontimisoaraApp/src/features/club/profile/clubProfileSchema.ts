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
})

export type ClubProfileValues = z.infer<typeof clubProfileSchema>
