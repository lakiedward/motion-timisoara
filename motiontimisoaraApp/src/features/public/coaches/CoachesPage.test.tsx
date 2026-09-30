import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { getCoaches, type CoachListItem } from '@/api/public'
import CoachesPage from '../CoachesPage'

vi.mock('@/api/public', () => ({
  getCoaches: vi.fn(),
  publicUrl: (_bucket: string, path: string | null) => path,
}))

const coachesRequest = vi.mocked(getCoaches)
const swimming = { id: 'swimming', code: 'SWIMMING', name: 'Înot' }
const cycling = { id: 'cycling', code: 'CYCLING', name: 'Ciclism' }

function coach(id: string, name: string, sports: (typeof swimming)[], photo: string | null = null) {
  return {
    id,
    user_id: `user-${id}`,
    photo_storage_path: photo,
    profile: { id: `user-${id}`, name, avatar_url: null },
    coach_sports: sports.map((sport) => ({ sport })),
  } as CoachListItem
}

const coaches = [
  coach('ana-pop', 'Ana Pop', [swimming], '/ana.jpg'),
  coach('ana-ionescu', 'Ana Ionescu', [cycling, swimming]),
  coach('mihai', 'Mihai Petrescu', [cycling]),
  coach('no-sports', 'Dana Radu', []),
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function renderDirectory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CoachesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

beforeEach(() => {
  coachesRequest.mockReset()
  coachesRequest.mockResolvedValue(coaches)
})

test('the public directory preserves the header and single-link photo/name/sports cards', async () => {
  renderDirectory()
  const card = await screen.findByRole('link', { name: /Ana Pop/ })

  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Antrenori')
  expect(screen.getByText('Echipă')).toBeInTheDocument()
  expect(screen.getByText('Antrenori dedicați sportului și copiilor')).toBeInTheDocument()
  expect(card).toHaveAttribute('href', '/antrenori/user-ana-pop')
  expect(within(card).getByRole('img', { name: 'Ana Pop' })).toHaveAttribute('src', '/ana.jpg')
  expect(within(card).getByText('Înot')).toBeInTheDocument()
  expect(card.querySelector('a, button')).toBeNull()
  expect(screen.getAllByRole('link')).toHaveLength(4)
  const initialCard = screen.getByRole('link', { name: /Mihai Petrescu/ })
  expect(within(initialCard).getByText('M')).toBeInTheDocument()
  expect(within(initialCard).queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Caută după nume')).toHaveValue('')
  expect(screen.getByLabelText('Sport')).toHaveValue('')
  expect(
    within(screen.getByRole('combobox', { name: 'Sport' })).getAllByRole('option'),
  ).toHaveLength(3)
})

test('name search matches a case-insensitive partial name without refetching the directory', async () => {
  renderDirectory()
  await screen.findByRole('link', { name: /Ana Pop/ })

  fireEvent.change(screen.getByLabelText('Caută după nume'), { target: { value: '  pOP  ' } })

  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('link', { name: /Ana Pop/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Ana Ionescu/ })).not.toBeInTheDocument()
  expect(coachesRequest).toHaveBeenCalledTimes(1)
})

test('name and sport filters combine with AND and retain the full sport option list', async () => {
  renderDirectory()
  await screen.findByRole('link', { name: /Ana Pop/ })

  fireEvent.change(screen.getByLabelText('Sport'), { target: { value: cycling.id } })
  expect(screen.getAllByRole('link')).toHaveLength(2)
  fireEvent.change(screen.getByLabelText('Caută după nume'), { target: { value: 'ANA' } })

  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('link', { name: /Ana Ionescu/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Ana Pop/ })).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Înot' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Toate sporturile' })).toBeInTheDocument()
})

test('a filtered empty result has its own message and resetting clears both filters', async () => {
  renderDirectory()
  await screen.findByRole('link', { name: /Ana Pop/ })
  fireEvent.change(screen.getByLabelText('Sport'), { target: { value: swimming.id } })
  fireEvent.change(screen.getByLabelText('Caută după nume'), { target: { value: 'Mihai' } })

  expect(
    screen.getByText('Niciun antrenor nu corespunde căutării și filtrelor.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Niciun antrenor disponibil momentan.')).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Resetează filtrele' }))

  expect(screen.getByLabelText('Caută după nume')).toHaveValue('')
  expect(screen.getByLabelText('Sport')).toHaveValue('')
  expect(screen.getAllByRole('link')).toHaveLength(4)
  expect(screen.queryByRole('button', { name: 'Resetează filtrele' })).not.toBeInTheDocument()
  expect(coachesRequest).toHaveBeenCalledTimes(1)
})

test('a successful empty backend response keeps the backend empty state even with a search', async () => {
  coachesRequest.mockResolvedValue([])
  renderDirectory()
  expect(await screen.findByText('Niciun antrenor disponibil momentan.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Caută după nume'), { target: { value: 'Ana' } })

  expect(screen.getByText('Niciun antrenor disponibil momentan.')).toBeInTheDocument()
  expect(
    screen.queryByText('Niciun antrenor nu corespunde căutării și filtrelor.'),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Resetează filtrele' })).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a delayed request shows canonical skeletons and applies a search entered while loading', async () => {
  const request = deferred<CoachListItem[]>()
  coachesRequest.mockReturnValue(request.promise)
  renderDirectory()
  const loading = screen.getByRole('status', { name: 'Se încarcă antrenorii' })

  expect(loading.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  expect(screen.queryByText('Niciun antrenor disponibil momentan.')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Caută după nume'), { target: { value: 'Mihai' } })
  await act(async () => request.resolve(coaches))

  expect(await screen.findByRole('link', { name: /Mihai Petrescu/ })).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.queryByRole('status', { name: 'Se încarcă antrenorii' })).not.toBeInTheDocument()
})

test('a failed initial load shows an error and retry recovers without claiming an empty directory', async () => {
  const recovery = deferred<CoachListItem[]>()
  coachesRequest
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockReturnValueOnce(recovery.promise)
  renderDirectory()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca antrenorii.')
  expect(screen.queryByText('Niciun antrenor disponibil momentan.')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Caută după nume'), { target: { value: 'Ionescu' } })
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('status', { name: 'Se încarcă antrenorii' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
  await act(async () => recovery.resolve(coaches))

  expect(await screen.findByRole('link', { name: /Ana Ionescu/ })).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(coachesRequest).toHaveBeenCalledTimes(2)
})

test('a failed refresh hides stale cards and recovery preserves the name and sport intersection', async () => {
  coachesRequest.mockResolvedValueOnce(coaches).mockRejectedValueOnce(new Error('Refresh failed'))
  const client = renderDirectory()
  await screen.findByRole('link', { name: /Ana Pop/ })
  fireEvent.change(screen.getByLabelText('Sport'), { target: { value: cycling.id } })
  fireEvent.change(screen.getByLabelText('Caută după nume'), { target: { value: 'Ana' } })
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['coaches'] })
  })

  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca antrenorii.')
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  const recovery = deferred<CoachListItem[]>()
  coachesRequest.mockReturnValueOnce(recovery.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('status', { name: 'Se încarcă antrenorii' })).toBeInTheDocument()
  await act(async () => recovery.resolve(coaches))

  expect(await screen.findByRole('link', { name: /Ana Ionescu/ })).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByLabelText('Caută după nume')).toHaveValue('Ana')
  expect(screen.getByLabelText('Sport')).toHaveValue(cycling.id)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
