import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AdminSubscriptionsPage from './AdminSubscriptionsPage'
import { extendSubscription, getAdminSubscriptions } from '@/api/subscriptions/admin-subscriptions'
import { getSubscriptionSettings } from '@/api/subscriptions/subscriptions'
import { adminSubscription, inDays } from '@/test/admin-subscription-fixture'

vi.mock('@/api/subscriptions/admin-subscriptions', () => ({
  ADMIN_SUBSCRIPTIONS_QUERY_KEY: ['admin-subscriptions'],
  getAdminSubscriptions: vi.fn(),
  extendSubscription: vi.fn(),
}))
vi.mock('@/api/subscriptions/subscriptions', () => ({
  SUBSCRIPTION_QUERY_KEY: ['my-subscription'],
  SUBSCRIPTION_SETTINGS_QUERY_KEY: ['subscription-settings'],
  getSubscriptionSettings: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const SUBSCRIPTIONS = () => [
  adminSubscription(),
  adminSubscription({
    id: 's2',
    subscriber_type: 'CLUB',
    subscriber_name: 'Club Delfinii',
    subscriber_email: 'office@delfinii.ro',
    plan_code: 'CLUB_START',
    plan_name: 'Club Start',
    price_bani: 19900,
    coach_count: 2,
    adjustments: [
      {
        id: 'a1',
        days: 14,
        reason: 'Probleme la plată',
        admin_name: 'Laki',
        created_at: '2026-11-01T10:00:00Z',
      },
    ],
  }),
  adminSubscription({
    id: 's3',
    subscriber_name: 'Ioana Șerban',
    subscriber_email: 'ioana@test.ro',
    plan_code: null,
    plan_name: null,
    price_bani: null,
    status: 'trialing',
    trial_end: inDays(5),
    access_end: inDays(5),
    has_stripe_subscription: false,
  }),
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdminSubscriptionsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getAdminSubscriptions).mockReset().mockResolvedValue(SUBSCRIPTIONS())
  vi.mocked(extendSubscription).mockReset()
  vi.mocked(getSubscriptionSettings)
    .mockReset()
    .mockResolvedValue({ launchAt: null, launchTrialDays: 90, signupTrialDays: 30 })
})

test('listează abonamentele grupate pe stare, cu venitul lunar estimat', async () => {
  renderPage()

  const active = await screen.findByRole('region', { name: 'Active' })
  expect(within(active).getByText('Andrei Marin')).toBeInTheDocument()
  expect(within(active).getByText('Club Delfinii')).toBeInTheDocument()
  expect(within(active).getByText(/Club Start · 1 prelungire/)).toBeInTheDocument()
  expect(within(active).getByText('299,00 lei pe lună')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Perioadă gratuită' })).toHaveTextContent(
    'Ioana Șerban',
  )
  expect(screen.getByText('Venit lunar estimat').nextSibling).toHaveTextContent('299,00 lei')
  expect(screen.getByText(/Lansarea abonamentelor nu e setată încă/)).toBeInTheDocument()
})

test('caută și filtrează după stare, tip și pachet', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('region', { name: 'Active' })

  await user.type(screen.getByRole('searchbox'), 'serban')
  expect(screen.queryByText('Andrei Marin')).not.toBeInTheDocument()
  expect(screen.getByText('Ioana Șerban')).toBeInTheDocument()

  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), 'zzz')
  expect(await screen.findByText('Niciun abonament pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))

  await user.click(screen.getByRole('button', { name: /^Perioadă gratuită/ }))
  expect(screen.queryByText('Andrei Marin')).not.toBeInTheDocument()
  expect(screen.getByText('Ioana Șerban')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^Toate\s*\d/ }))
  await user.click(screen.getByRole('button', { name: /^Club Start/ }))
  expect(screen.queryByText('Andrei Marin')).not.toBeInTheDocument()
  expect(screen.getByText('Club Delfinii')).toBeInTheDocument()
})

test('prelungește gratuit cu motiv, după confirmare', async () => {
  const user = userEvent.setup()
  vi.mocked(extendSubscription).mockResolvedValue({
    adjustmentId: 'a2',
    newEnd: '2026-12-26T10:00:00Z',
    stripeUpdated: true,
  })
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Detalii abonament Andrei Marin' }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText('andrei@test.ro')).toBeInTheDocument()
  expect(within(sheet).getByText(/Mutăm și data din Stripe/)).toBeInTheDocument()

  await user.click(within(sheet).getByRole('button', { name: 'Prelungește gratuit' }))
  expect(within(sheet).getByText('Scrie motivul (minim 3 caractere).')).toBeInTheDocument()
  expect(extendSubscription).not.toHaveBeenCalled()

  await user.click(within(sheet).getByRole('button', { name: '14 zile' }))
  expect(within(sheet).getByRole('status')).toHaveTextContent('Gratuit până pe 10.12.2026')
  await user.type(within(sheet).getByLabelText('Motiv (apare în istoric)'), 'Test cu proprietarul')
  await user.click(within(sheet).getByRole('button', { name: 'Prelungește gratuit' }))

  const confirm = await screen.findByRole('alertdialog', {
    name: 'Prelungești Andrei Marin cu 14 zile?',
  })
  expect(extendSubscription).not.toHaveBeenCalled()
  await user.click(within(confirm).getByRole('button', { name: 'Da, prelungește' }))
  await waitFor(() =>
    expect(extendSubscription).toHaveBeenCalledWith(
      { subscriptionId: 's1', days: 14, reason: 'Test cu proprietarul' },
      expect.anything(),
    ),
  )
})

test('arată istoricul prelungirilor și refuză zilele nevalide', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Detalii abonament Club Delfinii' }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText('„Probleme la plată”')).toBeInTheDocument()
  expect(within(sheet).getByText(/Laki/)).toBeInTheDocument()

  await user.clear(within(sheet).getByLabelText('Sau alt număr de zile (1–366)'))
  await user.type(within(sheet).getByLabelText('Sau alt număr de zile (1–366)'), '400')
  await user.type(within(sheet).getByLabelText('Motiv (apare în istoric)'), 'Motiv bun')
  await user.click(within(sheet).getByRole('button', { name: 'Prelungește gratuit' }))
  expect(within(sheet).getByText('Scrie un număr de zile între 1 și 366.')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('o perioadă gratuită fără dată de încheiere nu poate fi prelungită', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminSubscriptions).mockResolvedValue([
    adminSubscription({
      id: 's9',
      subscriber_name: 'Nou Venit',
      status: 'trialing',
      access_end: null,
      trial_end: null,
      plan_code: null,
      plan_name: null,
      price_bani: null,
    }),
  ])
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Detalii abonament Nou Venit' }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText(/nu are încă o dată de încheiere/)).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: 'Prelungește gratuit' })).not.toBeInTheDocument()
})

test('arată eroare cu reîncercare și stare goală', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminSubscriptions).mockRejectedValueOnce(new Error('x'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca abonamentele.')).toBeInTheDocument()
  vi.mocked(getAdminSubscriptions).mockResolvedValueOnce([])
  await user.click(screen.getByRole('button', { name: /Reîncearcă/ }))
  expect(await screen.findByText('Niciun abonament încă.')).toBeInTheDocument()
})
