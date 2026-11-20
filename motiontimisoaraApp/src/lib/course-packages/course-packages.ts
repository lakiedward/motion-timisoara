import { z } from 'zod'

import type { Tables } from '@/lib/database.types'
import { baniToRon, formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { parseScaledDecimal } from '@/lib/pricing/offer-currency'

import { MONTHLY } from './package-month'

export type CoursePackage = Pick<
  Tables<'course_packages'>,
  'id' | 'position' | 'sessions' | 'price' | 'validity' | 'validity_days'
>

export const MAX_COURSE_PACKAGES = 4
export const MAX_PACKAGE_SESSIONS = 100
const MAX_PACKAGE_PRICE = 10_000_000

export const DAYS = 'DAYS'
export const MIN_VALIDITY_DAYS = 7
export const MAX_VALIDITY_DAYS = 365

export type PackageValidity = 'NONE' | 'CALENDAR_MONTH' | 'DAYS'

export type CoursePackageDraft = {
  packageId?: string
  sessions: string
  price: string
  validity: PackageValidity
  validityDays?: string
}

function validDays(value: string | undefined): boolean {
  const text = (value ?? '').trim()
  const days = Number(text)
  return /^\d+$/.test(text) && days >= MIN_VALIDITY_DAYS && days <= MAX_VALIDITY_DAYS
}

const sessionsSchema = z
  .string()
  .trim()
  .min(1, 'Scrie numărul de ședințe')
  .refine(
    (value) =>
      value === '' ||
      (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_PACKAGE_SESSIONS),
    `Între 1 și ${MAX_PACKAGE_SESSIONS} ședințe`,
  )

const priceSchema = z
  .string()
  .trim()
  .min(1, 'Scrie prețul pachetului')
  .refine((value) => {
    if (value === '') return true
    const amount = parseScaledDecimal(value, 2)
    return amount !== null && amount > 0
  }, 'Introdu o sumă mai mare decât zero, cu cel mult două zecimale')
  .refine(
    (value) => (parseScaledDecimal(value, 2) ?? 0) <= MAX_PACKAGE_PRICE,
    'Prețul unui pachet poate fi cel mult 100.000',
  )

export const coursePackagesSchema = z
  .array(
    z.object({
      packageId: z.string().optional(),
      sessions: sessionsSchema,
      price: priceSchema,
      validity: z.enum(['NONE', 'CALENDAR_MONTH', 'DAYS']),
      validityDays: z.string().optional(),
    }),
  )
  .max(MAX_COURSE_PACKAGES, `Cel mult ${MAX_COURSE_PACKAGES} pachete`)
  .superRefine((packages, ctx) => {
    if (new Set(packages.map((item) => item.validity)).size > 1) {
      ctx.addIssue({
        code: 'custom',
        path: [],
        message: 'Pachetele unui curs au toate aceeași valabilitate.',
      })
    } else if (packages[0]?.validity === DAYS) {
      if (!validDays(packages[0].validityDays)) {
        ctx.addIssue({
          code: 'custom',
          path: [0, 'validityDays'],
          message: `Scrie un număr de zile între ${MIN_VALIDITY_DAYS} și ${MAX_VALIDITY_DAYS}`,
        })
      } else if (
        packages.some(
          (item) => (item.validityDays ?? '').trim() !== (packages[0].validityDays ?? '').trim(),
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [],
          message: 'Pachetele unui curs expiră toate după același număr de zile.',
        })
      }
    }
    const seen = new Set<string>()
    packages.forEach((item, index) => {
      const sessions = Number(item.sessions)
      if (!/^\d+$/.test(item.sessions.trim())) return
      const key = `${sessions}:${item.validity}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'sessions'],
          message:
            item.validity === MONTHLY
              ? `Ai deja un pachet lunar de ${sessions} ședințe`
              : `Ai deja un pachet de ${sessions} ședințe`,
        })
      }
      seen.add(key)
    })
  })

export type CoursePackagesFormValues = { packages: CoursePackageDraft[] }

export function emptyCoursePackage(): CoursePackageDraft {
  return { sessions: '', price: '', validity: 'NONE' }
}

function draftValidity(validity: string): PackageValidity {
  return validity === MONTHLY || validity === DAYS ? validity : 'NONE'
}

export function packagesToForm(packages: CoursePackage[] | undefined): CoursePackageDraft[] {
  return [...(packages ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      packageId: item.id,
      sessions: String(item.sessions),
      price: String(baniToRon(item.price)),
      validity: draftValidity(item.validity),
      ...(item.validity === DAYS && item.validity_days
        ? { validityDays: String(item.validity_days) }
        : {}),
    }))
}

export function packagesToPayload(drafts: CoursePackageDraft[]) {
  return drafts.map((item) => ({
    ...(item.packageId ? { id: item.packageId } : {}),
    sessions: Number(item.sessions.trim()),
    price: parseScaledDecimal(item.price, 2)!,
    validity: item.validity,
    ...(item.validity === DAYS ? { validityDays: Number((item.validityDays ?? '').trim()) } : {}),
  }))
}

export function pricePerSession(item: Pick<CoursePackage, 'sessions' | 'price'>): number {
  return Math.round(item.price / item.sessions)
}

export function sessionsLabel(sessions: number): string {
  return plural(sessions, 'ședință', 'ședințe')
}

export function cheapestPerSession(packages: Pick<CoursePackage, 'sessions' | 'price'>[]): number {
  return Math.min(...packages.map(pricePerSession))
}

export function daysLabel(days: number): string {
  return plural(days, 'zi', 'zile')
}

export function validityLabel(validity: string, days?: number | null): string {
  if (validity === MONTHLY) return 'pachet lunar, expiră la sfârșitul lunii'
  if (validity === DAYS && days) return `valabil ${daysLabel(days)} de la plată`
  return 'fără expirare'
}

export function packageNote(
  item: Pick<CoursePackage, 'sessions' | 'price' | 'validity'> & { validity_days?: number | null },
  currency: string,
): string {
  return `${formatMoney(pricePerSession(item), currency)} / ședință · ${validityLabel(item.validity, item.validity_days)}`
}
