import type { CoursePackage } from './course-packages'
import { MONTHLY, packageMonthOptions } from './package-month'

export const DEFAULT_SESSION_COUNT = 10
export const PACKAGE_CHANGED = 'PACKAGE_CHANGED'
export const MONTH_CHANGED = 'MONTH_CHANGED'

export type CheckoutChoice = { sessions: number; packageId?: string; month?: string }

const SOLD = ['NONE', MONTHLY]

export function saleablePackages(packages: CoursePackage[] | undefined): CoursePackage[] {
  return [...(packages ?? [])]
    .filter((item) => SOLD.includes(item.validity))
    .sort((a, b) => a.position - b.position)
}

export function packageChoice(
  item: Pick<CoursePackage, 'id' | 'sessions' | 'validity'>,
  month?: string,
  now: Date = new Date(),
): CheckoutChoice {
  if (item.validity !== MONTHLY) return { sessions: item.sessions, packageId: item.id }
  const months = packageMonthOptions(now).map((option) => option.value)
  return {
    sessions: item.sessions,
    packageId: item.id,
    month: month && months.includes(month) ? month : months[0],
  }
}

export function effectiveChoice(
  packages: CoursePackage[],
  choice: CheckoutChoice,
  now: Date = new Date(),
): CheckoutChoice {
  if (packages.length === 0) {
    return choice.packageId ? { sessions: DEFAULT_SESSION_COUNT } : choice
  }
  const chosen = packages.find((item) => item.id === choice.packageId)
  return packageChoice(chosen ?? packages[0], chosen ? choice.month : undefined, now)
}

export function choiceRequest(choice: CheckoutChoice) {
  if (!choice.packageId) return { sessionPackageSize: choice.sessions }
  return choice.month
    ? { coursePackageId: choice.packageId, packageMonth: choice.month }
    : { coursePackageId: choice.packageId }
}

export function choiceKey(choice: CheckoutChoice): string {
  if (!choice.packageId) return String(choice.sessions)
  return choice.month ? `${choice.packageId}:${choice.month}` : choice.packageId
}
