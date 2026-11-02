import type { ReactNode } from 'react'

import type { DashboardRowProps } from './DashboardGroups'

type CountSource = { isPending: boolean; isError: boolean; data?: readonly unknown[] }

export function countRowProps(
  query: CountSource,
  label: string,
  emptyHint: string,
  filledHint: ReactNode,
): Pick<DashboardRowProps, 'value' | 'loading' | 'hint' | 'ariaLabel'> {
  if (query.isError) {
    return {
      value: '—',
      hint: 'Nu am putut număra',
      ariaLabel: `${label}, indisponibil`,
    }
  }
  if (query.isPending || !query.data) {
    return { loading: true, ariaLabel: `${label}, se încarcă` }
  }
  const n = query.data.length
  return {
    value: n,
    hint: n === 0 ? emptyHint : filledHint,
    ariaLabel: `${label}, ${n}`,
  }
}
