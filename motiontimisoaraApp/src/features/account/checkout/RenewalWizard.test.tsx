import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'
import RenewalWizard from './RenewalWizard'
import { EnrollmentRequestError } from '@/api/checkout'
import { TERMS_VERSION } from './checkout-acceptance'

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  renew: vi.fn(),
  checkout: vi.fn(),
  navigate: vi.fn(),
  toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() },
}))
vi.mock('@/api/payments/renewal', () => ({
  validateRenewal: mocks.validate,
  renewEnrollment: mocks.renew,
}))
vi.mock('@/api/payments/checkout-session', () => ({ startStripeCheckout: mocks.checkout }))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent', name: 'Ana Părinte', email: 'ana@example.test' } }),
}))
vi.mock('@/lib/stripe', () => ({ stripeConfigured: true }))
vi.mock('./usePaymentAdapter', () => ({
  usePaymentAdapter: () => ({ ready: true, android: false, adapter: { confirm: vi.fn() } }),
}))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}))

const version = (size: number) => String(size).padStart(64, 'a')

function quote(size: number, extra: Record<string, unknown> = {}) {
  return {
    allowCash: true,
    renewal: {
      enrollmentId: 'enr-1',
      childId: 'child-1',
      courseId: 'course-1',
      name: 'Bebe',
      remainingSessions: 0,
      openPayment: null,
      eligible: true,
      amount: 1500 * size,
      currency: 'RON',
      priceVersion: version(size),
      ...extra,
    },
  }
}

function renderWizard(initialMethod: 'CARD' | 'CASH' = 'CASH') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RenewalWizard
          enrollmentId="enr-1"
          offering={{
            id: 'course-1',
            title: 'Înot pentru începători',
            perSession: true,
            packages: [5, 10, 20],
            rulesFingerprint: 'none',
          }}
          initialMethod={initialMethod}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.validate.mockImplementation((_id: string, size: number) => Promise.resolve(quote(size)))
  mocks.renew.mockResolvedValue({
    enrollmentId: 'enr-1',
    enrollmentIds: ['enr-1'],
    paymentId: 'pay-2',
    requiresPaymentIntent: false,
  })
  mocks.checkout.mockResolvedValue('redirected')
})

test('a parent buys five more sessions in cash for the same enrollment', async () => {
  const user = userEvent.setup()
  renderWizard('CASH')
  expect(await screen.findByText(/nu mai are ședințe/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '5 ședințe' }))
  await waitFor(() => expect(mocks.validate).toHaveBeenLastCalledWith('enr-1', 5))
  expect(await screen.findAllByText('75,00 lei')).not.toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Continuă' })).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: /Confirm suma finală/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(screen.getByText(/Ședințele se adaugă după ce antrenorul confirmă/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  await waitFor(() =>
    expect(mocks.renew).toHaveBeenCalledWith({
      enrollmentId: 'enr-1',
      sessionPackageSize: 5,
      paymentMethod: 'CASH',
      priceVersion: version(5),
      billingDetails: undefined,
      acceptance: { termsVersion: TERMS_VERSION, rulesFingerprint: 'none' },
    }),
  )
  expect(mocks.checkout).not.toHaveBeenCalled()
  expect(mocks.navigate).toHaveBeenCalledWith('/account/enrollments')
})

test('a card renewal collects billing and opens Stripe for the same enrollment', async () => {
  mocks.renew.mockResolvedValue({
    enrollmentId: 'enr-1',
    enrollmentIds: ['enr-1'],
    paymentId: 'pay-2',
    requiresPaymentIntent: true,
  })
  const user = userEvent.setup()
  renderWizard('CARD')
  await user.click(await screen.findByRole('checkbox', { name: /Confirm suma finală/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.type(screen.getByLabelText(/Adresă/), 'Str. Test 1')
  await user.type(screen.getByLabelText(/Oraș/), 'Timișoara')
  await user.type(screen.getByLabelText(/Cod poștal/), '300001')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(screen.getByRole('button', { name: /^Plătește 150,00 lei pe Stripe$/ }))
  await waitFor(() => expect(mocks.checkout).toHaveBeenCalledWith(['enr-1']))
  expect(mocks.renew.mock.calls[0][0]).toMatchObject({
    paymentMethod: 'CARD',
    sessionPackageSize: 10,
    billingDetails: { name: 'Ana Părinte', city: 'Timișoara' },
  })
})

test('a started card payment must be finished before buying again', async () => {
  mocks.validate.mockResolvedValue(
    quote(10, {
      openPayment: { id: 'pay-1', method: 'CARD', status: 'PENDING', amount: 7500, sessions: 5, started: true },
    }),
  )
  renderWizard('CASH')
  expect(await screen.findByText(/Ai o plată cu cardul începută pentru 5 ședințe/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Mergi la Înscrieri' })).toHaveAttribute('href', '/account/enrollments')
  expect(screen.queryByRole('checkbox', { name: /Confirm suma finală/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continuă' })).toBeDisabled()
})

test('an unpaid cash request can be replaced by another package', async () => {
  mocks.validate.mockImplementation((_id: string, size: number) =>
    Promise.resolve(
      quote(size, {
        openPayment: { id: 'pay-1', method: 'CASH', status: 'PENDING', amount: 7500, sessions: 5, started: false },
      }),
    ),
  )
  const user = userEvent.setup()
  renderWizard('CASH')
  expect(await screen.findByText(/Ai deja o plată în așteptare pentru 5 ședințe/)).toBeInTheDocument()
  expect(screen.getByText(/cererea de mai sus se înlocuiește/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '20 ședințe' }))
  await waitFor(() => expect(mocks.validate).toHaveBeenLastCalledWith('enr-1', 20))
  await user.click(await screen.findByRole('checkbox', { name: /Confirm suma finală/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  await waitFor(() => expect(mocks.renew).toHaveBeenCalledWith(expect.objectContaining({ sessionPackageSize: 20 })))
})

test('a changed price sends the parent back to confirm the new amount', async () => {
  mocks.renew.mockRejectedValueOnce(new EnrollmentRequestError('Prețul s-a schimbat.', 'PRICE_CHANGED'))
  const user = userEvent.setup()
  renderWizard('CASH')
  await user.click(await screen.findByRole('checkbox', { name: /Confirm suma finală/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Prețul s-a schimbat.'))
  expect(await screen.findByRole('checkbox', { name: /Confirm suma finală/ })).not.toBeChecked()
  expect(mocks.navigate).not.toHaveBeenCalled()
})
