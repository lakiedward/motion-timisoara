import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'

import CreateCoachForm from './CreateCoachForm'

const mocks = vi.hoisted(() => ({
  createCoach: vi.fn(),
  getClubs: vi.fn(),
}))
vi.mock('@/api/admin', async (original) => ({
  ...(await original<typeof import('@/api/admin')>()),
  createCoachAccount: mocks.createCoach,
  getAllClubs: mocks.getClubs,
}))

const clubs = [
  {
    id: '00000000-0000-4000-8000-0000000000a1',
    name: 'Club Sintetic',
    city: 'Timișoara',
    email: null,
  },
  { id: '00000000-0000-4000-8000-0000000000a2', name: 'Alt Club', city: null, email: null },
]

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CreateCoachForm />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă antrenor' }))
}

function fillCoach() {
  fireEvent.change(screen.getByLabelText('Nume'), { target: { value: 'Antrenor Test' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.test' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getClubs.mockResolvedValue(clubs)
})

test('club defaults to an independent coach and lists existing clubs', async () => {
  renderForm()
  const club = screen.getByLabelText('Club (opțional)')
  expect(club).toHaveValue('')
  expect(screen.getByRole('option', { name: 'Fără club — antrenor independent' })).toBeVisible()
  expect(await screen.findByRole('option', { name: 'Club Sintetic (Timișoara)' })).toBeVisible()
  expect(screen.getByRole('option', { name: 'Alt Club' })).toBeVisible()
})

test('selected club is sent and named in the confirmation', async () => {
  mocks.createCoach.mockResolvedValue({
    userId: 'synthetic-user',
    email: 'coach@example.test',
    tempPassword: 'synthetic-only-value',
    clubId: clubs[0].id,
  })
  renderForm()
  await screen.findByRole('option', { name: 'Club Sintetic (Timișoara)' })
  fillCoach()
  fireEvent.change(screen.getByLabelText('Club (opțional)'), { target: { value: clubs[0].id } })
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByText('Adăugat în clubul Club Sintetic.')).toBeVisible()
  expect(mocks.createCoach).toHaveBeenCalledWith({
    name: 'Antrenor Test',
    email: 'coach@example.test',
    phone: undefined,
    clubId: clubs[0].id,
  })
  expect(screen.getByLabelText('Club (opțional)')).toHaveValue('')
})

test('without a club the request omits it and the confirmation says independent', async () => {
  mocks.createCoach.mockResolvedValue({
    userId: 'synthetic-user',
    email: 'coach@example.test',
    tempPassword: 'synthetic-only-value',
    clubId: null,
  })
  renderForm()
  fillCoach()
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByText('Antrenor independent, fără club.')).toBeVisible()
  expect(mocks.createCoach.mock.calls[0][0].clubId).toBeUndefined()
})

test('failed club list keeps independent creation available with a retry', async () => {
  mocks.getClubs.mockRejectedValueOnce(new Error('offline'))
  mocks.createCoach.mockResolvedValue({
    userId: 'synthetic-user',
    email: 'coach@example.test',
    tempPassword: 'synthetic-only-value',
    clubId: null,
  })
  renderForm()
  expect(
    await screen.findByText('Lista cluburilor nu s-a încărcat. Poți crea un antrenor independent.'),
  ).toBeVisible()
  expect(screen.getByLabelText('Club (opțional)')).toHaveAccessibleDescription(
    /Lista cluburilor nu s-a încărcat/,
  )
  fillCoach()
  fireEvent.click(screen.getByRole('button', { name: 'Creează antrenor' }))
  expect(await screen.findByText('Antrenor independent, fără club.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('option', { name: 'Alt Club' })).toBeVisible()
  await waitFor(() => expect(screen.queryByText(/Lista cluburilor nu s-a încărcat/)).toBeNull())
})
