import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { CheckoutChoice } from '@/lib/course-packages/checkout-choice'
import type { CoursePackage } from '@/lib/course-packages/course-packages'
import { CheckoutPackagePicker } from './CheckoutPackagePicker'

const packages: CoursePackage[] = [
  { id: 'pkg-8', position: 0, sessions: 8, price: 32000, validity: 'NONE' },
  { id: 'pkg-m', position: 1, sessions: 4, price: 20000, validity: 'CALENDAR_MONTH' },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
})

afterEach(() => vi.useRealTimers())

function renderPicker(value: CheckoutChoice, onChange = vi.fn()) {
  render(
    <CheckoutPackagePicker
      packages={[]}
      coursePackages={packages}
      value={value}
      onChange={onChange}
    />,
  )
  return onChange
}

test('a package without expiry has no month to choose', () => {
  renderPicker({ sessions: 8, packageId: 'pkg-8' })
  expect(screen.getByText(/fără expirare/)).toBeInTheDocument()
  expect(screen.queryByText('Luna pachetului')).not.toBeInTheDocument()
})

test('a monthly package offers this month or next month and says when it ends', async () => {
  const onChange = renderPicker({ sessions: 4, packageId: 'pkg-m', month: '2026-11' })
  expect(screen.getByText('Luna pachetului')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /Luna aceasta \(noiembrie 2026\)/ })).toBeChecked()
  expect(screen.getByText('Valabil 1–30 noiembrie 2026')).toBeInTheDocument()
  expect(screen.getByText('30 noiembrie 2026')).toBeInTheDocument()
  expect(screen.getByText(/ședințele nefolosite se\s+pierd la sfârșitul lunii/)).toBeInTheDocument()
  await userEvent
    .setup({ advanceTimers: () => {} })
    .click(screen.getByRole('radio', { name: /Luna următoare \(decembrie 2026\)/ }))
  expect(onChange).toHaveBeenCalledWith({ sessions: 4, packageId: 'pkg-m', month: '2026-12' })
})

test('choosing the monthly package starts with the current month', async () => {
  const onChange = renderPicker({ sessions: 8, packageId: 'pkg-8' })
  await userEvent
    .setup({ advanceTimers: () => {} })
    .click(screen.getByRole('radio', { name: /4 ședințe/ }))
  expect(onChange).toHaveBeenCalledWith({ sessions: 4, packageId: 'pkg-m', month: '2026-11' })
})
