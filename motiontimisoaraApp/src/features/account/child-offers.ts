import type { EnrollmentRow } from '@/api/account'

const CURRENT = new Set(['ACTIVE', 'PENDING'])

export function activeOffersByChild(
  rows: Pick<EnrollmentRow, 'child_id' | 'status' | 'offerTitle'>[],
): Map<string, string[]> {
  const byChild = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.child_id || !CURRENT.has(row.status) || !row.offerTitle) continue
    const titles = byChild.get(row.child_id) ?? []
    if (!titles.includes(row.offerTitle)) titles.push(row.offerTitle)
    byChild.set(row.child_id, titles)
  }
  return byChild
}
