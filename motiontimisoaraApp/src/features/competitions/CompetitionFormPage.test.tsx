import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import CompetitionFormPage from './CompetitionFormPage'
import { createConcurs, getConcurs, stergeConcurs } from '@/api/competition/competitions'
import { setPickerValue } from '@/test/pickers'

const owner = { role: 'CLUB' as const, clubId: 'club-1', coachUserId: null }

vi.mock('@/api/competition/competitions', () => ({
  createConcurs: vi.fn(),
  getConcurs: vi.fn(),
  updateConcurs: vi.fn(),
  stergeConcurs: vi.fn(),
  urlHeroConcurs: () => null,
}))

vi.mock('@/api/competition/competition-hero', () => ({
  schimbaPozaConcurs: vi.fn().mockResolvedValue('k1/hero/a.jpg'),
  scoatePozaConcurs: vi.fn(),
}))

vi.mock('@/api/club', () => ({ getClubSelectableLocations: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/coach', () => ({ getSelectableLocations: vi.fn().mockResolvedValue([]) }))

vi.mock('./useCompetitionOwner', () => ({
  useCompetitionOwner: () => ({
    owner,
    gata: true,
    eroare: false,
    reincearca: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/galerie', () => ({
  galeriaSeDeschideNativ: () => false,
  alegeDinGalerie: vi.fn(),
}))

function deseneazaEditare() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/club/competitions/k1/edit']}>
        <Routes>
          <Route
            path="/club/competitions/:id/edit"
            element={<CompetitionFormPage baza="/club/competitions" />}
          />
          <Route path="/club/competitions" element={<div>lista concursuri</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/club/competitions/new']}>
        <Routes>
          <Route
            path="/club/competitions/new"
            element={<CompetitionFormPage baza="/club/competitions" />}
          />
          <Route path="/club/competitions" element={<div>lista concursuri</div>} />
          <Route path="/club/competitions/:id/edit" element={<div>editor concurs</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(createConcurs).mockReset()
})

test('titlul și descrierea goale nu pleacă spre server', async () => {
  const user = userEvent.setup()
  deseneaza()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Titlul este obligatoriu.')).toBeInTheDocument()
  expect(screen.getByText('Descrierea este obligatorie.')).toBeInTheDocument()
  expect(createConcurs).not.toHaveBeenCalled()
})

test('un concurs nou se salvează cu proprietarul clubului', async () => {
  const user = userEvent.setup()
  vi.mocked(createConcurs).mockResolvedValue({
    id: 'k1',
    slug: 'cupa',
    title: 'Cupa',
    description: 'Descriere suficientă.',
    hero_photo_storage_path: null,
    club_id: 'club-1',
    coach_id: null,
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    start_at: '2026-10-01T07:00:00Z',
    end_at: '2026-10-01T09:00:00Z',
    registration_deadline_at: '2026-09-30T21:00:00Z',
    location_id: null,
    location_text: 'Timișoara',
    allow_cash: false,
  })
  deseneaza()
  await user.type(screen.getByLabelText(/^Titlu/), 'Cupa')
  await user.type(screen.getByLabelText(/^Descriere/), 'Descriere suficientă.')
  setPickerValue(screen.getByLabelText(/^Data de început/), '2026-10-01')
  setPickerValue(screen.getByLabelText(/^Ora de început/), '10:00')
  setPickerValue(screen.getByLabelText(/^Data de final/), '2026-10-01')
  setPickerValue(screen.getByLabelText(/^Ora de final/), '12:00')
  setPickerValue(screen.getByLabelText(/^Ultima zi de înscriere/), '2026-09-30')
  setPickerValue(screen.getByLabelText(/^Ora închiderii înscrierilor/), '23:59')
  await user.type(screen.getByLabelText(/^Locația concursului/), 'Timișoara')
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(createConcurs).toHaveBeenCalledWith(
      {
        title: 'Cupa',
        description: 'Descriere suficientă.',
        start_at: '2026-10-01T07:00:00.000Z',
        end_at: '2026-10-01T09:00:00.000Z',
        registration_deadline_at: '2026-09-30T20:59:00.000Z',
        location_id: null,
        location_text: 'Timișoara',
        allow_cash: false,
      },
      owner,
    ),
  )
  expect(await screen.findByText('editor concurs')).toBeInTheDocument()
})

test('formularul are Înapoi, câmpuri obligatorii marcate și Anulează', () => {
  deseneaza()
  expect(screen.getByRole('link', { name: 'Înapoi la concursuri' })).toHaveAttribute(
    'href',
    '/club/competitions',
  )
  expect(screen.getByText(/sunt obligatorii/)).toBeInTheDocument()
  expect(screen.getByText('Despre concurs')).toBeInTheDocument()
  expect(screen.getByText('Program și înscrieri')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Titlu/)).toBeRequired()
  expect(screen.getByRole('link', { name: 'Anulează' })).toHaveAttribute(
    'href',
    '/club/competitions',
  )
  expect(screen.queryByText('Renunță')).not.toBeInTheDocument()
})

test('ștergerea cere confirmare în dialogul comun și Anulează păstrează concursul', async () => {
  const user = userEvent.setup()
  vi.mocked(getConcurs).mockResolvedValue({
    id: 'k1',
    slug: 'cupa',
    title: 'Cupa',
    description: 'Descriere suficientă.',
    hero_photo_storage_path: 'k1/hero/a.jpg',
    club_id: 'club-1',
    coach_id: null,
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    start_at: '2026-10-01T07:00:00Z',
    end_at: '2026-10-01T09:00:00Z',
    registration_deadline_at: '2026-09-30T21:00:00Z',
    location_id: null,
    location_text: 'Timișoara',
    allow_cash: false,
  })
  vi.mocked(stergeConcurs).mockResolvedValue(undefined)
  deseneazaEditare()
  await user.click(await screen.findByRole('button', { name: 'Șterge concursul' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Ștergi concursul?')
  await user.click(screen.getByRole('button', { name: 'Anulează' }))
  expect(stergeConcurs).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Șterge concursul' }))
  const confirm = await screen.findByRole('alertdialog')
  await user.click(within(confirm).getByRole('button', { name: 'Șterge concursul' }))
  await waitFor(() => expect(stergeConcurs).toHaveBeenCalledWith('k1'))
  expect(await screen.findByText('lista concursuri')).toBeInTheDocument()
})
