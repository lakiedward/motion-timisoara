import { z } from 'zod'

import type { Tables } from '@/lib/database.types'
import { baniToRon } from '@/lib/money'
import { plural } from '@/lib/plural'
import { parseScaledDecimal } from '@/lib/pricing/offer-currency'

export type CoursePackage = Pick<
  Tables<'course_packages'>,
  'id' | 'position' | 'sessions' | 'price' | 'validity'
>

export const MAX_COURSE_PACKAGES = 4
export const MAX_PACKAGE_SESSIONS = 100
const MAX_PACKAGE_PRICE = 10_000_000

export const COURSE_PACKAGES_ON_SALE = false

export type CoursePackageDraft = { packageId?: string; sessions: string; price: string }

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
    z.object({ packageId: z.string().optional(), sessions: sessionsSchema, price: priceSchema }),
  )
  .max(MAX_COURSE_PACKAGES, `Cel mult ${MAX_COURSE_PACKAGES} pachete`)
  .superRefine((packages, ctx) => {
    const seen = new Set<number>()
    packages.forEach((item, index) => {
      const sessions = Number(item.sessions)
      if (!/^\d+$/.test(item.sessions.trim())) return
      if (seen.has(sessions)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'sessions'],
          message: `Ai deja un pachet de ${sessions} ședințe`,
        })
      }
      seen.add(sessions)
    })
  })

export type CoursePackagesFormValues = { packages: CoursePackageDraft[] }

export function emptyCoursePackage(): CoursePackageDraft {
  return { sessions: '', price: '' }
}

export function packagesToForm(packages: CoursePackage[] | undefined): CoursePackageDraft[] {
  return [...(packages ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      packageId: item.id,
      sessions: String(item.sessions),
      price: String(baniToRon(item.price)),
    }))
}

export function packagesToPayload(drafts: CoursePackageDraft[]) {
  return drafts.map((item) => ({
    ...(item.packageId ? { id: item.packageId } : {}),
    sessions: Number(item.sessions.trim()),
    price: parseScaledDecimal(item.price, 2)!,
    validity: 'NONE' as const,
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
