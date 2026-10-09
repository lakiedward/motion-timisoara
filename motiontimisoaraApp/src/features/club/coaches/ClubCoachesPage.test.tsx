import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'

import ClubCoachesPage from './ClubCoachesPage'

const mocks = vi.hoisted(() => ({
  getMyClub: vi.fn(),
  getCoaches: vi.fn(),
  getCodes: vi.fn(),
  generate: vi.fn(),
  deleteCode: vi.fn(),
  createCoach: vi.fn(),
  removeCoach: vi.fn(),
}))
vi.mock('@/api/club', async (original) => ({
  ...(await original<typeof import('@/api/club')>()),
  getMyClub: mocks.getMyClub,
  getClubCoaches: mocks.getCoaches,
  getClubCodes: mocks.getCodes,
  generateClubCode: mocks.generate,
  deleteClubCode: mocks.deleteCode,
  createManagedCoach: mocks.createCoach,
  removeClubCoach: mocks.removeCoach,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const coach = {
  coach_profile_id: 'cp-1',
  name: 'Andrei Popescu',
  email: 'andrei@exemplu.ro',
  photo_storage_path: null,
}
const code = (over: Record<string, unknown>) => ({
  id: 'k1',
  club_id: 'club-1',
  code: 'ABCD-EF23',
  created_at: '2026-10-01T10:00:00Z',
  created_by_user_id: 'u',
  current_uses: 0,
  max_uses: 1,
  expires_at: null,
  notes: null,
  ...over,
})

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ClubCoachesPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getMyClub.mockResolvedValue({ id: 'club-1' })
  mocks.getCoaches.mockResolvedValue([coach])
  mocks.getCodes.mockResolvedValue([])
  mocks.generate.mockResolvedValue('NEWC-0DE2')
  mocks.createCoach.mockResolvedValue({
    userId: 'n',
    email: 'ioana@exemplu.ro',
    tempPassword: 'Tmp-1',
  })
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

test('coach cards expose a named, touch-sized removal that asks for confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderPage()
  const remove = await screen.findByRole('button', { name: 'Elimină antrenorul Andrei Popescu' })
  expect(remove.className).toContain('min-h-11')
  expect(remove.className).toContain('min-w-11')
  fireEvent.click(remove)
  expect(confirm).toHaveBeenCalledWith('Elimini antrenorul Andrei Popescu din club?')
  expect(mocks.removeCoach).not.toHaveBeenCalled()
  confirm.mockRestore()
})

test('a failed coach list shows an error with retry instead of the empty message', async () => {
  mocks.getCoaches.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([coach])
  renderPage()
  const alert = await screen.findByText('Nu am putut încărca antrenorii clubului.')
  expect(screen.queryByText(/Niciun antrenor în club/)).toBeNull()
  fireEvent.click(within(alert.parentElement!).getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Andrei Popescu')).toBeVisible()
})

test('an empty club shows the empty message', async () => {
  mocks.getCoaches.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText(/Niciun antrenor în club/)).toBeVisible()
})

test('the direct form uses first and last name and links errors to fields', async () => {
  renderPage()
  await screen.findByText('Andrei Popescu')
  fireEvent.click(screen.getByRole('button', { name: /Creează antrenor/ }))
  const first = screen.getByLabelText('Prenume')
  await waitFor(() => expect(first).toHaveAttribute('aria-invalid', 'true'))
  expect(first.getAttribute('aria-describedby')).toBe('coach-firstName-error')
  expect(document.getElementById('coach-firstName-error')).toHaveTextContent('Minim 2 caractere')
  expect(first.className).toContain('min-h-11')

  fireEvent.change(first, { target: { value: 'Ioana' } })
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'Marin' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ioana@exemplu.ro' } })
  fireEvent.click(screen.getByRole('button', { name: /Creează antrenor/ }))
  await waitFor(() =>
    expect(mocks.createCoach).toHaveBeenCalledWith({
      name: 'Ioana Marin',
      email: 'ioana@exemplu.ro',
      phone: undefined,
    }),
  )
  expect(await screen.findByRole('button', { name: 'Copiază parola temporară' })).toBeVisible()
  expect(screen.getByText('Tmp-1')).toBeVisible()
})

test('club codes show status, uses and expiry, with named actions', async () => {
  mocks.getCodes.mockResolvedValue([
    code({ id: 'a', code: 'ACTV-0001' }),
    code({ id: 'b', code: 'USED-0002', current_uses: 1 }),
    code({ id: 'c', code: 'EXPR-0003', expires_at: '2000-01-01T10:00:00Z' }),
  ])
  renderPage()
  expect(await screen.findByText('ACTV-0001')).toBeVisible()
  expect(screen.getByText('Activ')).toBeVisible()
  expect(screen.getByText('Folosit')).toBeVisible()
  expect(screen.getAllByText('Expirat')[0]).toBeVisible()
  expect(screen.getByText(/Expirat pe/)).toBeVisible()
  expect(screen.getAllByText(/Utilizări: \d\/1/)).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Copiază codul invitație 1' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Șterge codul invitație 3' })).toBeVisible()
})

test('generating a club code passes the club, max uses and expiry and shows the new code', async () => {
  renderPage()
  expect(
    await screen.findByText('Niciun cod. Generează unul pentru a invita un antrenor.'),
  ).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Cod nou' }))
  fireEvent.change(screen.getByLabelText('Număr maxim de utilizări'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: /Generează cod/ }))
  await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith('club-1', 3, null))
  expect(await screen.findByText('NEWC-0DE2')).toBeVisible()
})

test('a failed code list shows retry', async () => {
  mocks.getCodes.mockRejectedValue(new Error('boom'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca codurile.')).toBeVisible()
})
