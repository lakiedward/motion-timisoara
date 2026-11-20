import type { CoursePackage } from './course-packages'

export const DEFAULT_SESSION_COUNT = 10
export const PACKAGE_CHANGED = 'PACKAGE_CHANGED'

export type CheckoutChoice = { sessions: number; packageId?: string }

export function saleablePackages(packages: CoursePackage[] | undefined): CoursePackage[] {
  return [...(packages ?? [])]
    .filter((item) => item.validity === 'NONE')
    .sort((a, b) => a.position - b.position)
}

export function packageChoice(item: Pick<CoursePackage, 'id' | 'sessions'>): CheckoutChoice {
  return { sessions: item.sessions, packageId: item.id }
}

export function effectiveChoice(packages: CoursePackage[], choice: CheckoutChoice): CheckoutChoice {
  if (packages.length === 0) {
    return choice.packageId ? { sessions: DEFAULT_SESSION_COUNT } : choice
  }
  const chosen = packages.find((item) => item.id === choice.packageId)
  return packageChoice(chosen ?? packages[0])
}

export function choiceRequest(choice: CheckoutChoice) {
  return choice.packageId
    ? { coursePackageId: choice.packageId }
    : { sessionPackageSize: choice.sessions }
}

export function choiceKey(choice: CheckoutChoice): string {
  return choice.packageId ?? String(choice.sessions)
}
