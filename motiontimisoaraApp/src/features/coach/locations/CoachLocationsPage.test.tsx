import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { toast } from 'sonner'

import CoachLocationsPage from '../CoachLocationsPage'
import { getMyLocations, setLocationActive } from '@/api/coach'

vi.mock('@/api/coach', () => ({
  getMyLocations: vi.fn(),
  setLocationActive: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedLocatii = vi.mocked(getMyLocations)
const mockedComuta = vi.mocked(setLocationActive)

const loc = (id: string, name: string, is_active: boolean, courseCount = 0) => ({
  id,
  name,
  is_active,
  courseCount,
  address: 'Str. Audit 1',
  city: 'Timișoara',
  type: 'POOL',
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachLocationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedLocatii.mockResolvedValue([
    loc('a', 'Bazinul Olimpia', true, 2),
    loc('b', 'Parcul Rozelor', false),
  ] as never)
  mockedComuta.mockResolvedValue(undefined as never)
})

test('o încărcare căzută arată eroare cu reîncercare, nu lista goală', async () => {
  mockedLocatii.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca locațiile.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio locație încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('fără locații apare starea goală comună cu primul pas', async () => {
  mockedLocatii.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText('Nicio locație încă.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adaugă prima locație' })).toHaveAttribute(
    'href',
    '/coach/locations/new',
  )
})

test('activele și inactivele stau în grupuri separate, cu numărul lor', async () => {
  renderPage()
  const active = await screen.findByRole('region', { name: 'Active' })
  const inactive = screen.getByRole('region', { name: 'Inactive' })
  expect(within(active).getByRole('heading', { level: 2 }).textContent).toBe('Active · 1')
  expect(within(inactive).getByText('Parcul Rozelor')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Locațiile mele(2)')
})

test('căutarea filtrează după nume și oferă ștergerea filtrelor', async () => {
  const user = userEvent.setup()
  renderPage()
  const cauta = await screen.findByRole('searchbox', { name: 'Caută locații după nume sau adresă' })
  await user.type(cauta, 'olimpia')
  expect(screen.getByText('Bazinul Olimpia')).toBeInTheDocument()
  expect(screen.queryByText('Parcul Rozelor')).not.toBeInTheDocument()
  await user.clear(cauta)
  await user.type(cauta, 'nimic')
  expect(screen.getByText('Nicio locație pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(screen.getByText('Parcul Rozelor')).toBeInTheDocument()
})

test('rândul arată câte cursuri se țin acolo și duce la editarea antrenorului', async () => {
  renderPage()
  expect(await screen.findByText('2 cursuri aici')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează Bazinul Olimpia' })).toHaveAttribute(
    'href',
    '/coach/locations/a/edit',
  )
})

test('dezactivarea cere confirmare și apoi spune că s-a făcut', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Dezactivează Bazinul Olimpia' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog.textContent).toContain('se țin 2 cursuri')
  expect(mockedComuta).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('button', { name: 'Dezactivează' }))
  await waitFor(() => expect(mockedComuta).toHaveBeenCalledWith('a', false))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Bazinul Olimpia a fost dezactivată.'),
  )
})

test('activarea nu cere confirmare', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Activează Parcul Rozelor' }))
  await waitFor(() => expect(mockedComuta).toHaveBeenCalledWith('b', true))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
