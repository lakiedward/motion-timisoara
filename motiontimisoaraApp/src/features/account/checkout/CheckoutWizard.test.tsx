import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'
import CheckoutWizard from './CheckoutWizard'
import { EnrollmentRequestError } from '@/api/checkout'
import type { Offering } from '../CheckoutPage'
import { TERMS_VERSION } from './checkout-acceptance'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  validate: vi.fn(),
  children: vi.fn(),
  toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() },
  navigate: vi.fn(),
  checkout: vi.fn(),
}))
vi.mock('@/api/payments/checkout-session', () => ({ startStripeCheckout: mocks.checkout }))

vi.mock('@/api/checkout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/checkout')>()),
  createEnrollment: mocks.create,
  validateEnrollment: mocks.validate,
}))
vi.mock('@/api/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/account')>()),
  getMyChildren: mocks.children,
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'parent', name: 'Părinte' } }) }))
vi.mock('@/lib/stripe', () => ({ stripeConfigured: true }))
vi.mock('./usePaymentAdapter', () => ({
  usePaymentAdapter: () => ({ ready: true, android: false, adapter: { confirm: vi.fn() } }),
}))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}))

function renderWizard(extra: Partial<Offering> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CheckoutWizard
          kind="CAMP"
          offering={{ id: 'camp-1', title: 'Tabără de munte', perSession: false, packages: [], ...extra }}
          initialMethod="CARD"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.children.mockResolvedValue([{ id: 'bebe', name: 'Bebe', birth_date: '2025-01-01' }])
  mocks.validate.mockResolvedValue({
    allowCash: false,
    capacity: { available: 10, requested: 1, sufficient: true },
    results: [
      {
        childId: 'bebe',
        name: 'Bebe',
        eligible: true,
        amount: 0,
        currency: 'RON',
        priceVersion: 'a'.repeat(64),
      },
    ],
  })
  mocks.create.mockResolvedValue({
    enrollmentId: 'enroll-1',
    enrollmentIds: ['enroll-1'],
    requiresPaymentIntent: false,
    prices: [{ childId: 'bebe', amount: 0, currency: 'RON' }],
  })
})

test('a free camp child can confirm Gratuit and enroll without card billing', async () => {
  mocks.validate.mockResolvedValue({
    allowCash: false,
    capacity: { available: 10, requested: 1, sufficient: true },
    results: [
      {
        childId: 'bebe',
        name: 'Bebe',
        eligible: true,
        amount: 0,
        currency: 'RON',
        priceVersion: 'a'.repeat(64),
      },
    ],
  })
  const user = userEvent.setup()
  renderWizard()
  await user.click(await screen.findByRole('checkbox', { name: /Bebe/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findAllByText('Gratuit')).toHaveLength(2)
  expect(screen.getByText('Total').parentElement).toHaveTextContent('Gratuit')
  await user.click(screen.getByRole('checkbox', { name: /Confirm suma finală/ }))
  expect(screen.getByRole('button', { name: 'Finalizează' })).toBeEnabled()
  expect(screen.queryByText('Facturare')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  await waitFor(() => expect(mocks.create).toHaveBeenCalled())
  expect(mocks.create.mock.calls[0][0]).toMatchObject({
    paymentMethod: 'CARD',
    billingDetails: undefined,
    childIds: ['bebe'],
    includeSelf: false,
  })
  await waitFor(() =>
    expect(mocks.toast.success).toHaveBeenCalledWith('Înscriere confirmată. Nu este nevoie de plată.'),
  )
})

test('a parent can enroll themselves as an adult without selecting a child', async () => {
  mocks.validate.mockResolvedValue({
    allowCash: false,
    capacity: { available: 10, requested: 0, sufficient: true },
    results: [
      {
        childId: 'bebe',
        name: 'Bebe',
        eligible: true,
        amount: 80000,
        currency: 'RON',
        priceVersion: 'a'.repeat(64),
      },
    ],
    adult: {
      adultProfileId: 'parent',
      name: 'Părinte',
      eligible: true,
      amount: 0,
      currency: 'RON',
      priceVersion: 'b'.repeat(64),
    },
  })
  mocks.create.mockResolvedValue({
    enrollmentId: 'enroll-adult',
    enrollmentIds: ['enroll-adult'],
    requiresPaymentIntent: false,
    prices: [{ adultProfileId: 'parent', amount: 0, currency: 'RON' }],
  })
  const user = userEvent.setup()
  renderWizard()
  expect(await screen.findByText('Participanți')).toBeInTheDocument()
  await user.click(await screen.findByRole('checkbox', { name: /Mă înscriu și eu/ }))
  expect(screen.getByRole('checkbox', { name: /Bebe/ })).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByText('Părinte')).toBeInTheDocument()
  expect(screen.getByText('Adult')).toBeInTheDocument()
  expect(screen.getByText('Total').parentElement).toHaveTextContent('Gratuit')
  await user.click(screen.getByRole('checkbox', { name: /Confirm suma finală/ }))
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  await waitFor(() => expect(mocks.create).toHaveBeenCalled())
  expect(mocks.create.mock.calls[0][0]).toMatchObject({
    includeSelf: true,
    childIds: [],
    paymentMethod: 'CARD',
  })
  expect(mocks.create.mock.calls[0][0].priceVersions).toMatchObject({
    parent: 'b'.repeat(64),
  })
})

test('a paid card order goes to one Stripe Checkout page for every saved enrollment', async () => {
  mocks.validate.mockResolvedValue({
    allowCash: false,
    capacity: { available: 10, requested: 1, sufficient: true },
    results: [
      { childId: 'bebe', name: 'Bebe', eligible: true, amount: 40000, currency: 'RON', priceVersion: 'a'.repeat(64) },
    ],
  })
  mocks.create.mockResolvedValue({
    enrollmentId: 'enroll-1',
    enrollmentIds: ['enroll-1'],
    requiresPaymentIntent: true,
    prices: [{ childId: 'bebe', amount: 40000, currency: 'RON' }],
  })
  mocks.checkout.mockResolvedValue('redirected')
  const user = userEvent.setup()
  renderWizard()
  await user.click(await screen.findByRole('checkbox', { name: /Bebe/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(await screen.findByRole('checkbox', { name: /Confirm suma finală/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  const values = ['Părinte Audit', 'audit@example.test', 'Strada Audit 1', 'Timișoara', '300001']
  for (const [index, field] of screen.getAllByRole('textbox').entries()) {
    await user.clear(field)
    await user.type(field, values[index])
  }
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByText(/Plătești pe pagina securizată Stripe/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Plătește 400,00 lei pe Stripe$/ }))
  await waitFor(() => expect(mocks.checkout).toHaveBeenCalledWith(['enroll-1']))
  expect(await screen.findByRole('button', { name: /Te ducem la Stripe/ })).toBeDisabled()
  expect(mocks.navigate).not.toHaveBeenCalled()
})

test('the order carries the accepted terms version and rules fingerprint, and changed rules ask for consent again', async () => {
  mocks.create.mockRejectedValueOnce(
    new EnrollmentRequestError('Regulamentul ofertei s-a schimbat.', 'RULES_CHANGED'),
  )
  const user = userEvent.setup()
  renderWizard({ rulesFingerprint: 'text:abc' })
  await user.click(await screen.findByRole('checkbox', { name: /Bebe/ }))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(await screen.findByRole('checkbox', { name: /Confirm suma finală/ }))
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  await waitFor(() => expect(mocks.create).toHaveBeenCalled())
  expect(mocks.create.mock.calls[0][0].acceptance).toEqual({
    termsVersion: TERMS_VERSION,
    rulesFingerprint: 'text:abc',
  })
  await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Regulamentul ofertei s-a schimbat.'))
  expect(screen.getByRole('checkbox', { name: /Confirm suma finală/ })).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Finalizează' })).toBeDisabled()
})
