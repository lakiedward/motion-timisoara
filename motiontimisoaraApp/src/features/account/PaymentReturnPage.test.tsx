import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getEnrollmentPayments, type EnrollmentPayment } from '@/api/payments/enrollments'
import { startStripeCheckout } from '@/api/payments/checkout-session'
import PaymentReturnPage from './PaymentReturnPage'

vi.mock('@/api/payments/enrollments', () => ({ getEnrollmentPayments: vi.fn() }))
vi.mock('@/api/payments/checkout-session', () => ({ startStripeCheckout: vi.fn() }))

const load = vi.mocked(getEnrollmentPayments)
const start = vi.mocked(startStripeCheckout)

function enrollment(id: string, status: string) {
  return {
    id,
    child: { id: `child-${id}`, name: 'Ana' },
    payments: [{ id: `p-${id}`, status }],
  } as unknown as EnrollmentPayment
}

function renderAt(search: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/plata${search}`]}>
        <PaymentReturnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  load.mockReset()
  start.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

test('a confirmed Stripe payment shows the success state with every enrollment', async () => {
  load.mockResolvedValue([enrollment('a', 'SUCCEEDED'), enrollment('b', 'SUCCEEDED')])
  renderAt('?rezultat=reusita&inscrieri=a,b')
  expect(await screen.findByText('Plată confirmată')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Înscrierea este activă')
  expect(load).toHaveBeenCalledWith(['a', 'b'])
  expect(screen.getByRole('link', { name: 'Vezi înscrierile' })).toHaveAttribute(
    'href',
    '/account/enrollments',
  )
})

test('a payment the webhook has not confirmed yet waits, then says it is in progress', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  load.mockResolvedValue([enrollment('a', 'PENDING')])
  renderAt('?rezultat=reusita&inscrieri=a')
  expect(await screen.findByRole('status', { name: 'Confirmăm plata…' })).toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12500)
  })
  expect(screen.getByText('Plata e în curs de confirmare')).toBeInTheDocument()
  expect(load.mock.calls.length).toBeGreaterThan(1)
})

test('a canceled Stripe page offers to resume the same payment', async () => {
  load.mockResolvedValue([enrollment('a', 'PENDING')])
  start.mockResolvedValue('redirected')
  renderAt('?rezultat=anulata&inscrieri=a')
  expect(await screen.findByText('Plata nu a fost finalizată')).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Reia plata' }))
  expect(start).toHaveBeenCalledWith(['a'])
  expect(await screen.findByText('Te ducem la Stripe…')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Înapoi la Înscrieri' })).toBeInTheDocument()
})

test('a return link without enrollments points back to Înscrieri', () => {
  renderAt('')
  expect(screen.getByText('Nu găsim plata.')).toBeInTheDocument()
  expect(load).not.toHaveBeenCalled()
})
