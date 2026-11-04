import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AdminPaymentsPage from './AdminPaymentsPage'
import { getAdminPayments, refundPayment } from '@/api/payments/admin-payments'
import { adminPayment } from '@/test/admin-payment-fixture'

vi.mock('@/api/payments/admin-payments', () => ({
  ADMIN_PAYMENTS_QUERY_KEY: ['admin-payments'],
  getAdminPayments: vi.fn(),
  refundPayment: vi.fn(),
}))
vi.mock('@/api/payments/cash-payments', () => ({
  CASH_PAYMENTS_QUERY_KEY: ['cash-payments'],
  confirmCashPayment: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdminPaymentsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getAdminPayments).mockReset()
  vi.mocked(refundPayment).mockReset()
})

test('arată cine a plătit, cum și când, grupat pe zile, cu totaluri', async () => {
  vi.mocked(getAdminPayments).mockResolvedValue([
    adminPayment(),
    adminPayment({
      id: 'p2',
      source: 'SUBSCRIPTION_INVOICE',
      kind: 'CLUB',
      offer_title: 'Club',
      payer_name: 'Club Delfinii',
      participant_name: null,
      receiver_name: 'Motion România',
      amount: 34900,
      paid_at: '2026-11-03T09:15:00Z',
    }),
  ])
  renderPage()

  const today = await screen.findByRole('region', { name: /4 noiembrie 2026/ })
  expect(within(today).getByText('Andreea Popescu')).toBeInTheDocument()
  expect(within(today).getByText(/Curs · Înot copii · Matei/)).toBeInTheDocument()
  expect(
    within(today).getByText(/10:42 · Visa •••• 4242 · către Club Delfinii/),
  ).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /3 noiembrie 2026/ })).toHaveTextContent(
    'Abonament club · Club',
  )
  expect(screen.getByText('Încasat').nextSibling).toHaveTextContent('829,00 lei')
  expect(getAdminPayments).toHaveBeenCalledWith(
    expect.objectContaining({ from: expect.stringMatching(/Z$/), to: expect.stringMatching(/Z$/) }),
  )
})

test('rambursează parțial cu motiv, după confirmare, și spune cine suportă costul Stripe', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminPayments).mockResolvedValue([adminPayment()])
  vi.mocked(refundPayment).mockResolvedValue({ refundId: 'r1', status: 'succeeded' })
  renderPage()

  await user.click(await screen.findByRole('button', { name: /Detalii plată Andreea Popescu/ }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText('Card prin Stripe · Visa •••• 4242')).toBeInTheDocument()
  expect(within(sheet).getByText('8,20 lei')).toBeInTheDocument()
  await user.click(within(sheet).getByRole('button', { name: 'Rambursează' }))
  expect(
    within(sheet).getByText(
      /Costul Stripe nu se întoarce la rambursare: îl suportă antrenorul sau clubul/,
    ),
  ).toBeInTheDocument()

  await user.click(within(sheet).getByRole('button', { name: 'Parțial' }))
  await user.type(within(sheet).getByLabelText('Sumă (lei)'), '600')
  await user.click(within(sheet).getByRole('button', { name: 'Rambursează' }))
  expect(within(sheet).getByText('Poți rambursa cel mult 480,00 lei.')).toBeInTheDocument()
  expect(within(sheet).getByText('Scrie motivul (minim 3 caractere).')).toBeInTheDocument()

  await user.clear(within(sheet).getByLabelText('Sumă (lei)'))
  await user.type(within(sheet).getByLabelText('Sumă (lei)'), '120')
  await user.type(within(sheet).getByLabelText('Motiv (apare în istoric)'), 'Ședință ratată')
  expect(within(sheet).queryByText(/Anulează și înscrierea/)).not.toBeInTheDocument()
  await user.click(within(sheet).getByRole('button', { name: 'Rambursează 120,00 lei' }))
  const confirm = await screen.findByRole('alertdialog', {
    name: 'Rambursezi 120,00 lei către Andreea Popescu?',
  })
  expect(refundPayment).not.toHaveBeenCalled()
  await user.click(within(confirm).getByRole('button', { name: 'Da, rambursează' }))
  await waitFor(() =>
    expect(refundPayment).toHaveBeenCalledWith(
      {
        source: 'PAYMENT',
        id: 'p1',
        amount: 12000,
        reason: 'Ședință ratată',
        cancelEnrollment: false,
      },
      expect.anything(),
    ),
  )
})

test('o plată fără contul Stripe al organizatorului se rambursează din contul platformei', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminPayments).mockResolvedValue([
    adminPayment({ transferred: false, receiver_name: 'Motion România', stripe_fee_amount: null }),
  ])
  renderPage()

  await user.click(await screen.findByRole('button', { name: /Detalii plată Andreea Popescu/ }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText('Motion România')).toBeInTheDocument()
  await user.click(within(sheet).getByRole('button', { name: 'Rambursează' }))
  expect(within(sheet).getByText(/suma iese din contul platformei/)).toBeInTheDocument()
  expect(within(sheet).queryByText(/îl suportă antrenorul sau clubul/)).not.toBeInTheDocument()
})

test('rambursarea totală poate anula și înscrierea', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminPayments).mockResolvedValue([adminPayment()])
  vi.mocked(refundPayment).mockResolvedValue({ refundId: 'r1', status: 'pending' })
  renderPage()

  await user.click(await screen.findByRole('button', { name: /Detalii plată Andreea Popescu/ }))
  const sheet = await screen.findByRole('dialog')
  await user.click(within(sheet).getByRole('button', { name: 'Rambursează' }))
  await user.type(within(sheet).getByLabelText('Motiv (apare în istoric)'), 'Curs anulat')
  await user.click(within(sheet).getByRole('checkbox'))
  await user.click(within(sheet).getByRole('button', { name: 'Rambursează 480,00 lei' }))
  await user.click(await screen.findByRole('button', { name: 'Da, rambursează' }))
  await waitFor(() =>
    expect(refundPayment).toHaveBeenCalledWith(
      { source: 'PAYMENT', id: 'p1', amount: 48000, reason: 'Curs anulat', cancelEnrollment: true },
      expect.anything(),
    ),
  )
})

test('filtrele și căutarea au stare goală cu ștergerea filtrelor', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminPayments).mockResolvedValue([adminPayment()])
  renderPage()
  await screen.findByText('Andreea Popescu')
  await user.type(screen.getByRole('searchbox'), 'nimeni')
  expect(screen.getByText('Nicio plată pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(screen.getByText('Andreea Popescu')).toBeInTheDocument()
})

test('eroarea de încărcare se poate reîncerca, iar perioada fără plăți are stare goală', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminPayments).mockRejectedValueOnce(new Error('down')).mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Nu am putut încărca plățile.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Încearcă din nou|Reîncearcă/ }))
  expect(await screen.findByText('Nicio plată în perioada aleasă.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Export CSV/ })).toBeDisabled()
})

test('intervalul personalizat schimbă perioada cerută', async () => {
  const user = userEvent.setup()
  vi.mocked(getAdminPayments).mockResolvedValue([])
  renderPage()
  await screen.findByText('Nicio plată în perioada aleasă.')
  await user.click(screen.getByRole('button', { name: 'Interval' }))
  expect(screen.getByLabelText('De la')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Azi' }))
  await waitFor(() => expect(getAdminPayments).toHaveBeenCalledTimes(2))
})
