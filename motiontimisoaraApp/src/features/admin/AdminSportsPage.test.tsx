import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'

import AdminSportsPage from './AdminSportsPage'
import { fetchSports, type Sport } from '@/api/sports'
import {
  clearSportDefaultPhoto,
  createSport,
  deleteSport,
  setSportDefaultPhoto,
  SportMutationError,
} from '@/api/sports/admin-sports'

vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('@/api/sports/admin-sports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/sports/admin-sports')>()),
  createSport: vi.fn(),
  deleteSport: vi.fn(),
  setSportDefaultPhoto: vi.fn(),
  clearSportDefaultPhoto: vi.fn(),
}))
vi.mock('@/api/public', () => ({
  publicUrl: (_bucket: string, path: string | null) =>
    path ? `https://example.test/${path}` : null,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const sports: Sport[] = [
  { id: 'a', name: 'Alergare', code: 'alergare', default_photo_storage_path: 'a/old.jpg' },
  { id: 'b', name: 'Înot', code: 'inot', default_photo_storage_path: null },
]

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AdminSportsPage />
    </QueryClientProvider>,
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchSports).mockResolvedValue(sports)
  vi.mocked(createSport).mockResolvedValue(undefined)
  vi.mocked(deleteSport).mockResolvedValue(undefined)
  vi.mocked(setSportDefaultPhoto).mockResolvedValue({ path: 'a/new.jpg', warning: null })
  vi.mocked(clearSportDefaultPhoto).mockResolvedValue({ path: null, warning: null })
})

test('loading, failed load with retry and successful empty response are distinct', async () => {
  const waiting = deferred<Sport[]>()
  vi.mocked(fetchSports)
    .mockReturnValueOnce(waiting.promise)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([])
  const page = renderPage()
  expect(screen.getByRole('status', { name: 'Se încarcă sporturile' })).toBeInTheDocument()
  expect(screen.queryByText('Nu există sporturi adăugate.')).not.toBeInTheDocument()
  waiting.resolve(sports)
  await screen.findByText('Alergare')
  page.unmount()
  renderPage()
  await screen.findByText('Nu am putut încărca sporturile.')
  expect(screen.queryByText('Nu există sporturi adăugate.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Nu există sporturi adăugate.')).toBeInTheDocument()
})

test.each([' ', 'a', '🎾🎾'])(
  'invalid name %s makes no mutation and explains the refusal',
  async (name) => {
    renderPage()
    await screen.findByText('Alergare')
    await userEvent.type(screen.getByLabelText('Nume sport nou'), name)
    await userEvent.click(screen.getByRole('button', { name: 'Adaugă' }))
    expect(createSport).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/Numele sportului/)
    expect(screen.getByLabelText('Nume sport nou')).toHaveAttribute('aria-invalid', 'true')
  },
)

test('add trims payload, blocks repeated submits, then refreshes and clears the successful form', async () => {
  const waiting = deferred<void>()
  vi.mocked(createSport).mockReturnValue(waiting.promise)
  renderPage()
  await screen.findByText('Alergare')
  const input = screen.getByLabelText('Nume sport nou')
  await userEvent.type(input, '  Șah  ')
  await userEvent.click(screen.getByRole('button', { name: 'Adaugă' }))
  await userEvent.click(screen.getByRole('button', { name: 'Se adaugă…' }))
  expect(createSport).toHaveBeenCalledExactlyOnceWith('sah', 'Șah')
  expect(input).toBeDisabled()
  waiting.resolve()
  await waitFor(() => expect(input).toHaveValue(''))
  expect(fetchSports).toHaveBeenCalledTimes(2)
  expect(toast.success).toHaveBeenCalledWith('Sport adăugat.')
})

test('duplicate code keeps the entered name and existing rows for retry', async () => {
  vi.mocked(createSport).mockRejectedValue(
    new SportMutationError('Există deja un sport cu acest cod.'),
  )
  renderPage()
  await screen.findByText('Alergare')
  await userEvent.type(screen.getByLabelText('Nume sport nou'), 'Alergare')
  await userEvent.click(screen.getByRole('button', { name: 'Adaugă' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('acest cod')
  expect(screen.getByLabelText('Nume sport nou')).toHaveValue('Alergare')
  expect(screen.getByText('Înot')).toBeInTheDocument()
})

test('canceling delete sends no request, while confirmed deletion targets only the selected sport', async () => {
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderPage()
  await screen.findByText('Alergare')
  await userEvent.click(screen.getByRole('button', { name: 'Șterge sportul Înot' }))
  expect(confirmation).toHaveBeenCalledWith('Ștergi sportul Înot?')
  expect(deleteSport).not.toHaveBeenCalled()
  confirmation.mockReturnValue(true)
  await userEvent.click(screen.getByRole('button', { name: 'Șterge sportul Înot' }))
  await waitFor(() => expect(deleteSport).toHaveBeenCalledExactlyOnceWith('b'))
  expect(toast.success).toHaveBeenCalledWith('Sport șters.')
  confirmation.mockRestore()
})

test('failed delete keeps both rows and does not claim a network error means existing usage', async () => {
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(deleteSport).mockRejectedValue(new Error('offline'))
  renderPage()
  await screen.findByText('Alergare')
  await userEvent.click(screen.getByRole('button', { name: 'Șterge sportul Alergare' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/conexiunea/)
  expect(screen.getByRole('alert')).not.toHaveTextContent(/folosit/)
  expect(screen.getByText('Alergare')).toBeInTheDocument()
  expect(screen.getByText('Înot')).toBeInTheDocument()
  confirmation.mockRestore()
})

test('pending photo save blocks competing row mutations and duplicated uploads', async () => {
  const waiting = deferred<{ path: string; warning: null }>()
  vi.mocked(setSportDefaultPhoto).mockReturnValue(waiting.promise)
  renderPage()
  await screen.findByText('Alergare')
  const chooser = screen.getByLabelText('Alege poza standard pentru Alergare')
  const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })
  fireEvent.change(chooser, { target: { files: [file] } })
  fireEvent.change(chooser, { target: { files: [file] } })
  await waitFor(() => expect(setSportDefaultPhoto).toHaveBeenCalledTimes(1))
  expect(setSportDefaultPhoto).toHaveBeenCalledWith('a', file)
  expect(screen.getByRole('button', { name: 'Șterge sportul Înot' })).toBeDisabled()
  waiting.resolve({ path: 'a/new.jpg', warning: null })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Șterge sportul Înot' })).toBeEnabled(),
  )
})

test('canceling file selection makes no upload and partial storage cleanup shows warning without false success', async () => {
  vi.mocked(clearSportDefaultPhoto).mockResolvedValue({
    path: null,
    warning: 'Poza a fost scoasă, dar fișierul rămâne în Storage.',
  })
  renderPage()
  await screen.findByText('Alergare')
  fireEvent.change(screen.getByLabelText('Alege poza standard pentru Alergare'), {
    target: { files: [] },
  })
  expect(setSportDefaultPhoto).not.toHaveBeenCalled()
  await userEvent.click(
    screen.getByRole('button', { name: 'Scoate poza standard pentru Alergare' }),
  )
  await waitFor(() => expect(clearSportDefaultPhoto).toHaveBeenCalledExactlyOnceWith('a'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage')
  expect(toast.warning).toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

test('failed image association reports partial result and refetches the confirmed current row', async () => {
  vi.mocked(setSportDefaultPhoto).mockRejectedValue(
    new SportMutationError(
      'Fotografia a fost încărcată în Storage, dar asocierea nu a fost confirmată.',
    ),
  )
  renderPage()
  await screen.findByText('Alergare')
  fireEvent.change(screen.getByLabelText('Alege poza standard pentru Alergare'), {
    target: { files: [new File(['image'], 'new.jpg', { type: 'image/jpeg' })] },
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('nu a fost confirmată')
  expect(fetchSports).toHaveBeenCalledTimes(2)
  expect(toast.success).not.toHaveBeenCalled()
})
