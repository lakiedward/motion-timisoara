import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ActivityFormPage from './ActivityFormPage'
import { createActivity, getSelectableLocations } from '@/api/coach'
import { fetchSports } from '@/api/sports'
import { getCursBnr } from '@/api/bnr-rate'

vi.mock('@/api/coach', () => ({
  getSelectableLocations: vi.fn(),
  getActivityById: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('@/api/bnr-rate', async () => {
  const real = await vi.importActual<typeof import('@/api/bnr-rate')>('@/api/bnr-rate')
  return { ...real, getCursBnr: vi.fn() }
})
vi.mock('@/api/offer-hero', () => ({
  schimbaPozaOferta: vi.fn().mockResolvedValue('a/hero/a.jpg'),
  renuntaLaOfertaFaraHero: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const LOC = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'
const mockedCreate = vi.mocked(createActivity)

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/coach/activities/new']}>
        <Routes>
          <Route path="/coach/activities/new" element={<ActivityFormPage />} />
          <Route path="/coach/activities" element={<p>Lista activități</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchSports).mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  vi.mocked(getSelectableLocations).mockResolvedValue([
    { id: LOC, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
  ] as never)
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5123456 })
})

test('EUR citește cursul BNR și îl îngheață pe activitate', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'a-eur' } as never)
  renderForm()
  await user.type(await screen.findByLabelText('Nume'), 'Open water euro')
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC)
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText('Ora început'), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText('Ora final'), { target: { value: '11:00' } })
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Curs BNR din 19.09.2026: 5,123456 lei/EUR')).toBeInTheDocument()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Preț (EUR)'), '15')
  await user.type(screen.getByLabelText('Descriere'), 'Ieșire pe lac.')
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({
    currency: 'EUR',
    eur_ron_rate_micros: 5123456,
    price: 1500,
  })
})

test('fără poza din cap, activitatea nu se salvează', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText('Nume'), 'Fără poză')
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC)
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText('Ora început'), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText('Ora final'), { target: { value: '11:00' } })
  await user.type(screen.getByLabelText('Preț (lei)'), '20')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Poza din capul paginii este obligatorie.',
  )
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('fără curs BNR, EUR blochează salvarea activității', async () => {
  vi.mocked(getCursBnr).mockRejectedValue(new Error('Nu am putut citi cursul BNR. Reîncearcă.'))
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Nu am putut citi cursul BNR. Reîncearcă.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  expect(mockedCreate).not.toHaveBeenCalled()
})

async function completeaza(user: ReturnType<typeof userEvent.setup>, descriere = 'Ieșire pe lac.') {
  await user.type(await screen.findByLabelText('Nume'), 'Open water')
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC)
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText('Ora început'), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText('Ora final'), { target: { value: '11:00' } })
  await user.type(screen.getByLabelText('Preț (lei)'), '20')
  if (descriere) await user.type(screen.getByLabelText('Descriere'), descriere)
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
}

test('frazele de fus și de capacitate stau pe formular, iar poza folosește fraza scurtă', async () => {
  renderForm()
  expect(await screen.findByText('Orele sunt în fusul României.')).toBeInTheDocument()
  expect(screen.getByText('Lasă gol dacă nu ai limită.')).toBeInTheDocument()
  expect(screen.getByLabelText('Capacitate')).toHaveValue(null)
  expect(screen.getByText('Poza din capul paginii este obligatorie.')).toBeInTheDocument()
  expect(
    screen.queryByText(
      'Obligatorie. Se vede în banda de deasupra titlului, pe pagina publică. Galeria rămâne separată.',
    ),
  ).not.toBeInTheDocument()
})

test('ora final înainte de început oprește salvarea', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeaza(user)
  fireEvent.change(screen.getByLabelText('Ora final'), { target: { value: '08:00' } })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(
    await screen.findByText('Ora final trebuie să fie după ora de început.'),
  ).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('descrierea goală oprește salvarea', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeaza(user, '')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Descrierea este obligatorie.')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('capacitatea goală se salvează fără limită de locuri', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'a-cap' } as never)
  renderForm()
  await completeaza(user)
  expect(screen.getByLabelText('Capacitate')).toHaveValue(null)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({
    capacity: null,
    description: 'Ieșire pe lac.',
  })
})
