import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getMyChildren } from '@/api/account'
import type { TabaraDetaliu } from '@/api/camps'
import CampPricingCard from './CampPricingCard'

vi.mock('@/api/account', () => ({ getMyChildren: vi.fn() }))
let user: { id: string; role: string } | null
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user }) }))
const readChildren = vi.mocked(getMyChildren)
const enroll = vi.fn()

const prices = [
  { id: 'younger', age_from: 6, age_to: 8, amount: 60000, display_order: 0 },
  { id: 'older', age_from: 9, age_to: 12, amount: 80000, display_order: 1 },
]
const children = [
  { id: 'ana', name: 'Ana', birth_date: '2018-09-13', parent_id: 'parent-a' },
  { id: 'bogdan', name: 'Bogdan', birth_date: '2014-09-13', parent_id: 'parent-a' },
  { id: 'mara', name: 'Mara', birth_date: '2019-09-13', parent_id: 'parent-a' },
  { id: 'foreign', name: 'Copil străin', birth_date: '2018-09-13', parent_id: 'parent-b' },
]

function view({
  mode = 'by_age',
  agePrices = prices,
  ended = false,
  full = false,
  currency = 'RON',
} = {}) {
  const data = {
    tabara: {
      price: 99900,
      pricing_mode: mode,
      period_start: '2026-09-13',
      allow_cash: false,
      currency,
      eur_ron_rate_micros: currency === 'EUR' ? 5123456 : null,
    },
    categorii: [{ id: 'item', name: 'Cazare', description: 'Pensiune completă', amount: 99900 }],
    agePrices,
  } as unknown as TabaraDetaliu
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rendered = render(
    <QueryClientProvider client={client}>
      <CampPricingCard data={data} ended={ended} full={full} onEnroll={enroll} />
    </QueryClientProvider>,
  )
  return { ...rendered, client }
}

beforeEach(() => {
  user = { id: 'parent-a', role: 'PARENT' }
  readChildren.mockReset().mockResolvedValue(children as never)
  enroll.mockReset()
})

test('EUR age prices preserve their currency and explain the organizer exchange rate', () => {
  user = null
  view({ currency: 'EUR' })
  expect(screen.getByText('600,00 EUR')).toBeInTheDocument()
  expect(screen.getByText('800,00 EUR')).toBeInTheDocument()
  expect(screen.getByText(/1 EUR = 5,123456 lei/)).toBeInTheDocument()
  expect(screen.queryByText('600,00 lei')).not.toBeInTheDocument()
})

test('highlights every matching child and filters foreign children', async () => {
  view()
  const younger = await screen.findByText('Pentru Ana, Mara')
  expect(within(younger.closest('li')!).getByText('6–8 ani')).toBeInTheDocument()
  expect(
    within(screen.getByText('Pentru Bogdan').closest('li')!).getByText('9–12 ani'),
  ).toBeInTheDocument()
  expect(screen.queryByText(/Copil străin/)).not.toBeInTheDocument()
  expect(screen.getByText('600,00 lei')).toBeInTheDocument()
  expect(screen.getByText('800,00 lei')).toBeInTheDocument()
  expect(screen.queryByText(/999,00/)).not.toBeInTheDocument()
  expect(screen.getByText('Pensiune completă')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Înscrie-te' }))
  expect(enroll).toHaveBeenCalledOnce()
})

test.each([null, { id: 'coach', role: 'COACH' }])(
  'public tariffs do not load child data for %j',
  (identity) => {
    user = identity
    view()
    expect(screen.getByRole('list', { name: 'Tarife pe vârste' })).toBeInTheDocument()
    expect(readChildren).not.toHaveBeenCalled()
  },
)

test('single price preserves the amount and cost breakdown without child lookup', () => {
  view({ mode: 'single' })
  expect(screen.getByText(/Plătești o singură dată 999,00 lei/)).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Tarife pe vârste' })).not.toBeInTheDocument()
  expect(readChildren).not.toHaveBeenCalled()
})

test('shows empty and unmatched child states explicitly', async () => {
  readChildren.mockResolvedValue([{ ...children[0], birth_date: '2010-09-13' }] as never)
  const rendered = view()
  expect(
    await screen.findByText('Ana: nicio categorie disponibilă pentru 16 ani la începutul taberei.'),
  ).toBeInTheDocument()
  rendered.unmount()
  readChildren.mockResolvedValue([])
  view()
  expect(
    await screen.findByText('Nu ai copii înregistrați. Îi poți adăuga la înscriere.'),
  ).toBeInTheDocument()
})

test('public prices remain visible while children load', () => {
  readChildren.mockReturnValue(new Promise(() => undefined))
  view()
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.getByText('600,00 lei')).toBeInTheDocument()
})

test('child read error offers retry without hiding public prices', async () => {
  readChildren.mockRejectedValueOnce(new Error('network')).mockResolvedValue(children as never)
  view()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Nu am putut verifica categoriile copiilor tăi.',
  )
  expect(screen.getByText('600,00 lei')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Pentru Ana, Mara')).toBeInTheDocument()
})

test('missing age prices block enrollment without using the single price', () => {
  user = null
  view({ agePrices: [] })
  expect(screen.getByRole('alert')).toHaveTextContent('Prețurile pe vârste nu sunt disponibile.')
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
  expect(screen.queryByText(/999,00/)).not.toBeInTheDocument()
})

test('existing child mutations invalidate personalized categories', async () => {
  readChildren.mockResolvedValueOnce([]).mockResolvedValue(children as never)
  const { client } = view()
  expect(
    await screen.findByText('Nu ai copii înregistrați. Îi poți adăuga la înscriere.'),
  ).toBeInTheDocument()
  await client.invalidateQueries({ queryKey: ['children'] })
  expect(await screen.findByText('Pentru Ana, Mara')).toBeInTheDocument()
})

test.each([
  { ended: true, full: false },
  { ended: false, full: true },
])('preserves closed enrollment: %j', (state) => {
  user = null
  view(state)
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
  expect(
    screen.getByText(
      state.ended
        ? 'Tabăra s-a încheiat, înscrierile sunt închise.'
        : 'Toate locurile sunt ocupate.',
    ),
  ).toBeInTheDocument()
})
