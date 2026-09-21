import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { vi } from 'vitest'

import { OfferCurrencyFields } from './OfferCurrencyFields'
import { getCursBnr } from '@/api/bnr-rate'
import { eurFaraCurs } from '@/lib/pricing/offer-currency'

vi.mock('@/api/bnr-rate', async () => {
  const real = await vi.importActual<typeof import('@/api/bnr-rate')>('@/api/bnr-rate')
  return { ...real, getCursBnr: vi.fn() }
})

function Harness() {
  const { register, control, setValue } = useForm({
    defaultValues: { currency: 'RON' as 'RON' | 'EUR', eur_ron_rate: '' },
  })
  const currency = useWatch({ control, name: 'currency' })
  const cursEur = useWatch({ control, name: 'eur_ron_rate' })
  return (
    <form>
      <OfferCurrencyFields
        currency={currency}
        currencyField={register('currency')}
        setValue={setValue}
      />
      <button type="submit" disabled={eurFaraCurs(currency, cursEur)}>
        Salvează
      </button>
    </form>
  )
}

function renderFields() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getCursBnr).mockReset()
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5073100 })
})

test('RON nu cere curs și nu arată câmp tastat', () => {
  renderFields()
  expect(screen.getByRole('radio', { name: 'Lei (RON)' })).toBeChecked()
  expect(screen.queryByText(/Curs BNR din/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()
})

test('EUR arată încărcarea, apoi cursul BNR read-only', async () => {
  let elibereaza!: (value: { date: string; eur_ron_millionths: number }) => void
  vi.mocked(getCursBnr).mockReturnValue(
    new Promise((resolve) => {
      elibereaza = resolve
    }),
  )
  const user = userEvent.setup()
  renderFields()
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Se citește cursul BNR…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
  elibereaza({ date: '2026-09-21', eur_ron_millionths: 5264900 })
  expect(await screen.findByText('Curs BNR din 21.09.2026: 5,2649 lei/EUR')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()
})

test('fără curs BNR, EUR blochează salvarea și oferă reîncercare', async () => {
  vi.mocked(getCursBnr).mockRejectedValue(new Error('Nu am putut citi cursul BNR. Reîncearcă.'))
  const user = userEvent.setup()
  renderFields()
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Nu am putut citi cursul BNR. Reîncearcă.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5073100 })
  await user.click(screen.getByRole('button', { name: 'Reîncearcă cursul BNR' }))
  expect(await screen.findByText('Curs BNR din 19.09.2026: 5,0731 lei/EUR')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()
})
