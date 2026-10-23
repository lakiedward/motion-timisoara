import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { AntrenorInvitat } from '@/api/camp-coaches'
import CampCoachesSection from './CampCoachesSection'

const api = vi.hoisted(() => ({
  lista: vi.fn(),
  cauta: vi.fn(),
  invita: vi.fn(),
  retrage: vi.fn(),
}))

vi.mock('@/api/camp-coaches', () => ({
  getAntrenoriiTaberei: api.lista,
  cautaAntrenori: api.cauta,
  invitaAntrenor: api.invita,
  retrageInvitatia: api.retrage,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const acceptat: AntrenorInvitat = {
  coachProfileId: 'coach-1',
  nume: 'Ana Popescu',
  pozaUrl: null,
  stare: 'accepted',
  raspunsLa: null,
}

let antrenori: AntrenorInvitat[]

function randeaza() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CampCoachesSection campId="camp-1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  antrenori = []
  api.lista.mockImplementation(async () => antrenori)
  api.cauta.mockResolvedValue([])
  api.retrage.mockImplementation(async () => {
    antrenori = []
  })
})

test('lista goală spune ce faci, iar câmpul de căutare are eticheta legată', async () => {
  randeaza()
  expect(
    await screen.findByText('Nu ai invitat încă niciun antrenor. Caută-l după nume mai jos.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Invită un antrenor')).toHaveAttribute(
    'placeholder',
    'Minim două litere din nume',
  )
})

test('X cere confirmare și abia apoi scoate antrenorul acceptat', async () => {
  antrenori = [acceptat]
  const user = userEvent.setup()
  randeaza()

  await user.click(await screen.findByRole('button', { name: 'Scoate Ana Popescu din tabără' }))
  expect(await screen.findByText('Scoți Ana Popescu din tabără?')).toBeInTheDocument()
  expect(screen.getByText(/Dispare de pe pagina publică a taberei/)).toBeInTheDocument()
  expect(api.retrage).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Scoate din tabără' }))
  await waitFor(() => expect(api.retrage).toHaveBeenCalledWith('camp-1', 'coach-1'))
  expect(
    await screen.findByText('Nu ai invitat încă niciun antrenor. Caută-l după nume mai jos.'),
  ).toBeInTheDocument()
})

test('eroarea de căutare are Reîncearcă și nu spune că nu există antrenori', async () => {
  api.cauta.mockRejectedValueOnce(new Error('rețea'))
  const user = userEvent.setup()
  randeaza()

  await user.type(await screen.findByLabelText('Invită un antrenor'), 'An')
  expect(await screen.findByText('Nu am putut căuta antrenorii.')).toBeInTheDocument()
  expect(screen.queryByText(/Niciun antrenor nou/)).not.toBeInTheDocument()

  api.cauta.mockResolvedValueOnce([
    { coachProfileId: 'coach-2', nume: 'Andrei Ionescu', pozaUrl: null },
  ])
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Andrei Ionescu')).toBeInTheDocument()
})

test('eroarea la încărcare are Reîncearcă', async () => {
  api.lista.mockRejectedValueOnce(new Error('rețea'))
  const user = userEvent.setup()
  randeaza()

  expect(await screen.findByText('Nu am putut încărca antrenorii.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByLabelText('Invită un antrenor')).toBeInTheDocument()
})
