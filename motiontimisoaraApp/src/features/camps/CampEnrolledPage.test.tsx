import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import { getInscrisiiTaberei, type CopilInscris } from '@/api/camp-enrolled'
import { getTabaraDeEditat } from '@/api/camps-admin'
import { getCampParticipants, recordCampParticipation } from '@/api/live-location/discovery'
import CampEnrolledPage from './CampEnrolledPage'

const auth = vi.hoisted(() => ({ role: 'CLUB' as string }))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'club-1', role: auth.role } }),
}))

vi.mock('@/api/camp-enrolled', async () => {
  const real = await vi.importActual<typeof import('@/api/camp-enrolled')>('@/api/camp-enrolled')
  return { ...real, getInscrisiiTaberei: vi.fn() }
})

vi.mock('@/api/camps-admin', () => ({
  getTabaraDeEditat: vi.fn(),
}))

vi.mock('@/api/live-location/discovery', () => ({
  getCampParticipants: vi.fn(),
  recordCampParticipation: vi.fn(),
}))

const enrolled = vi.mocked(getInscrisiiTaberei)
const camp = vi.mocked(getTabaraDeEditat)
const participants = vi.mocked(getCampParticipants)
const record = vi.mocked(recordCampParticipation)

function person(
  partial: Partial<CopilInscris> & Pick<CopilInscris, 'enrollmentId' | 'nume' | 'fel'>,
): CopilInscris {
  return {
    stare: 'ACTIVE',
    inscrisLa: '2026-09-22T00:00:00Z',
    copilId: partial.fel === 'adult' ? null : 'child',
    dataNasterii: partial.fel === 'adult' ? null : '2016-01-01',
    marimeTricou: null,
    alergii: null,
    contactUrgenta: null,
    telefonUrgenta: null,
    contactSecundar: null,
    telefonSecundar: null,
    ...partial,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/club/camps/camp-1/enrolled']}>
        <Routes>
          <Route
            path="/club/camps/:id/enrolled"
            element={<CampEnrolledPage baza="/club/camps" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function cardFor(name: string) {
  const card = screen.getByText(name).closest('li')
  if (!card) throw new Error(`Lipsește cardul pentru ${name}`)
  return card
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.role = 'CLUB'
  camp.mockResolvedValue({
    title: 'Tabără audit 152',
    period_start: '2026-10-01',
    period_end: '2026-10-08',
    capacity: 3,
    rules: null,
    rules_file_storage_path: null,
    rules_file_name: null,
    rules_file_content_type: null,
    rules_file_size_bytes: null,
  } as Awaited<ReturnType<typeof getTabaraDeEditat>>)
  enrolled.mockResolvedValue([
    person({ enrollmentId: 'e-spec', nume: 'Copil Spec 520', fel: 'child', copilId: 'c-spec' }),
    person({ enrollmentId: 'e-audit', nume: 'Copil Audit 152', fel: 'child', copilId: 'c-audit' }),
    person({ enrollmentId: 'e-adult', nume: 'Parinte Spec 520', fel: 'adult' }),
  ])
  participants.mockResolvedValue({
    participants: [
      { enrollmentId: 'e-spec', childName: 'Copil Spec 520', arrivedAt: null, departedAt: null },
      { enrollmentId: 'e-audit', childName: 'Copil Audit 152', arrivedAt: null, departedAt: null },
    ],
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-09T00:00:00Z',
    canShare: false,
  })
  record.mockResolvedValue(undefined)
})

test('each person is one card, with arrival on the child and the adult only once', async () => {
  renderPage()
  expect(await screen.findByText('3 participanți înscriși din 3 locuri.')).toBeInTheDocument()
  expect(screen.getAllByText('Copil Spec 520')).toHaveLength(1)
  expect(screen.getAllByText('Copil Audit 152')).toHaveLength(1)
  expect(screen.getAllByText('Parinte Spec 520')).toHaveLength(1)
  expect(screen.queryByRole('heading', { name: 'Prezență în tabără' })).not.toBeInTheDocument()
  expect(screen.queryByText('Prezență în tabără')).not.toBeInTheDocument()

  const adult = cardFor('Parinte Spec 520')
  expect(within(adult).getByText('Adult', { selector: '[data-slot="badge"]' })).toBeInTheDocument()
  expect(within(adult).queryByRole('button', { name: 'Confirmă sosirea' })).not.toBeInTheDocument()
  expect(within(adult).queryByRole('link', { name: 'Cod QR' })).not.toBeInTheDocument()

  const child = cardFor('Copil Spec 520')
  expect(await within(child).findByText('Sosire neconfirmată')).toBeInTheDocument()
  fireEvent.click(within(child).getByRole('button', { name: 'Confirmă sosirea' }))
  await waitFor(() => expect(record).toHaveBeenCalledWith('arrive', 'camp-1', 'e-spec', 'club-1'))
  expect(screen.getAllByText('Copil Spec 520')).toHaveLength(1)
})

test('departure confirmation stays on the same child card', async () => {
  participants.mockResolvedValue({
    participants: [
      {
        enrollmentId: 'e-spec',
        childName: 'Copil Spec 520',
        arrivedAt: '2026-10-01T08:00:00Z',
        departedAt: null,
      },
    ],
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-09T00:00:00Z',
    canShare: false,
  })
  renderPage()
  expect(await screen.findByText('Copil Spec 520')).toBeInTheDocument()
  const child = cardFor('Copil Spec 520')
  expect(await within(child).findByText('Sosire confirmată')).toBeInTheDocument()
  fireEvent.click(within(child).getByRole('button', { name: 'Confirmă plecarea' }))
  expect(within(child).getByText(/a părăsit tabăra/)).toBeInTheDocument()
  expect(cardFor('Copil Audit 152').textContent).not.toContain('a părăsit tabăra')
  fireEvent.click(within(child).getByRole('button', { name: 'Da, a plecat' }))
  await waitFor(() => expect(record).toHaveBeenCalledWith('depart', 'camp-1', 'e-spec', 'club-1'))
})
