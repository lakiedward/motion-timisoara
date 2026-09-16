import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'
import CheckoutWizard from './CheckoutWizard'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  validate: vi.fn(),
  children: vi.fn(),
  toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() },
  navigate: vi.fn(),
}))

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
vi.mock('@/lib/stripe', () => ({ stripeConfigured: true, stripePromise: Promise.resolve(null) }))
vi.mock('./usePaymentAdapter', () => ({
  usePaymentAdapter: () => ({ ready: true, adapter: { confirm: vi.fn() } }),
}))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
}))

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CheckoutWizard
          kind="CAMP"
          offering={{ id: 'camp-1', title: 'Tabără de munte', perSession: false, packages: [] }}
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
  })
  await waitFor(() =>
    expect(mocks.toast.success).toHaveBeenCalledWith('Înscriere confirmată. Nu este nevoie de plată.'),
  )
})
