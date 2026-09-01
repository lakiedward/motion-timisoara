import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import ClubLocationsPage from './ClubLocationsPage'
import { getClubLocations, getMyClub, setClubLocationActive } from '@/api/club'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubLocations: vi.fn(),
  setClubLocationActive: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedLocatii = vi.mocked(getClubLocations)
const mockedComuta = vi.mocked(setClubLocationActive)

const loc = (
  id: string,
  name: string,
  is_active: boolean,
  courseCount = 0,
  address: string | null = 'Str. Audit 1',
  city: string | null = 'Timișoara',
) => ({ id, name, is_active, courseCount, address, city, type: 'POOL' })

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClubLocationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1' } as never)
  mockedLocatii.mockResolvedValue([
    loc('a', 'Bazin Audit Motion', true, 1),
    loc('b', 'Pin picker QA', false),
  ] as never)
  mockedComuta.mockResolvedValue(undefined as never)
})

// Regresie (criteriul 1): patru situații diferite ajungeau la același mesaj de
// listă goală, deci un club cu locații era invitat să-și adauge prima.
test('o încărcare căzută arată eroare cu reîncercare, nu mesajul de listă goală', async () => {
  mockedLocatii.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca locațiile.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio locație încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

// Bug #986, defectul 1. Testul de deasupra prinde doar locațiile picate. Când
// pică CLUBUL, `isPending` devine fals, `clubId` rămâne gol, deci interogarea
// locațiilor stă oprită de `enabled` — iar o interogare oprită are `isLoading`
// fals ȘI `isError` fals, deci cascada cădea tocmai pe „Nicio locație încă.”
test('un club care nu se poate încărca arată eroare, nu îndemnul de listă goală', async () => {
  mockedClub.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca locațiile.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio locație încă.')).not.toBeInTheDocument()
})

test('reîncercarea cere din nou clubul, nu locațiile, când clubul e cel căzut', async () => {
  const user = userEvent.setup()
  mockedClub.mockRejectedValue(new Error('network'))
  renderPage()
  await screen.findByText('Nu am putut încărca locațiile.')
  const inainte = mockedClub.mock.calls.length
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(mockedClub.mock.calls.length).toBeGreaterThan(inainte))
})

// Bug #986, defectul 2. Mutația e una singură pentru toată lista, iar
// `mutation.variables` păstrează doar argumentele ULTIMULUI `mutate`: a doua
// apăsare pe alt rând muta reperul și redeschidea butonul primului rând cât timp
// cererea lui era încă în zbor, deci a doua apăsare pe el chiar pleca la server.
test('butonul unui rând rămâne blocat și după ce se apasă alt rând', async () => {
  const user = userEvent.setup()
  mockedLocatii.mockResolvedValue([loc('a', 'Sala A', false), loc('b', 'Sala B', false)] as never)
  mockedComuta.mockReturnValue(new Promise(() => {}) as never) // rămâne în zbor
  renderPage()

  const butonA = await screen.findByRole('button', { name: 'Activează Sala A' })
  await user.click(butonA)
  expect(butonA).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Activează Sala B' }))
  expect(screen.getByRole('button', { name: 'Activează Sala A' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Activează Sala B' })).toBeDisabled()
})

// Regresie (criteriul 2): cât timp se încarcă clubul, interogarea de locații e
// oprită, iar `isLoading` e fals — deci ecranul arăta o clipă „Nicio locație încă.”
test('cât timp se încarcă clubul se vede scheletul, nu mesajul de listă goală', () => {
  mockedClub.mockReturnValue(new Promise(() => {}) as never)
  const { container } = renderPage()
  expect(screen.queryByText('Nicio locație încă.')).not.toBeInTheDocument()
  expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
})

test('un club fără locații vede îndemnul de a adăuga prima', async () => {
  mockedLocatii.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText('Nicio locație încă.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adaugă prima locație' })).toBeInTheDocument()
})

// Criteriul 3: azi acțiunea pleca tăcut, pe o locație cu curs activ.
test('dezactivarea cere confirmare care spune pe câte cursuri cade', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderPage()
  await screen.findByText('Bazin Audit Motion')

  await user.click(screen.getByRole('button', { name: 'Dezactivează Bazin Audit Motion' }))

  expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Se ține 1 curs aici'))
  expect(mockedComuta).not.toHaveBeenCalled()
  confirmSpy.mockRestore()
})

test('confirmarea acceptată chiar dezactivează', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderPage()
  await screen.findByText('Bazin Audit Motion')

  await user.click(screen.getByRole('button', { name: 'Dezactivează Bazin Audit Motion' }))
  await waitFor(() => expect(mockedComuta).toHaveBeenCalledWith('a', false))
  confirmSpy.mockRestore()
})

// Reactivarea nu are consecințe, deci nu-l punem pe club să confirme degeaba.
test('activarea nu cere confirmare', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm')
  renderPage()
  await screen.findByText('Pin picker QA')

  await user.click(screen.getByRole('button', { name: 'Activează Pin picker QA' }))
  await waitFor(() => expect(mockedComuta).toHaveBeenCalledWith('b', true))
  expect(confirmSpy).not.toHaveBeenCalled()
  confirmSpy.mockRestore()
})

// Criteriul 11: o sală scoasă din uz nu are de ce să stea între cele utilizabile.
test('locațiile active apar înaintea celor inactive', async () => {
  mockedLocatii.mockResolvedValue([
    loc('b', 'Aaa Inactivă', false),
    loc('a', 'Zzz Activă', true),
  ] as never)
  renderPage()
  const titluri = await screen.findAllByRole('heading', { level: 3 })
  expect(titluri.map((h) => h.textContent)).toEqual(['Zzz Activă', 'Aaa Inactivă'])
})

// Criteriul 7: virgula se punea necondiționat după adresă, iar liniuța de rezervă
// a orașului cădea după ea, deci se citea „Str. Audit 1, —”.
test('o locație fără oraș nu mai afișează o virgulă în aer', async () => {
  mockedLocatii.mockResolvedValue([loc('a', 'Fără oraș', true, 0, 'Str. Audit 1', null)] as never)
  renderPage()
  await screen.findByText('Fără oraș')
  expect(screen.getByText('Str. Audit 1')).toBeInTheDocument()
  expect(screen.queryByText(/Str\. Audit 1,\s*—/)).not.toBeInTheDocument()
})

// Criteriul 6: un cititor de ecran anunța N butoane identice „Dezactivează”.
test('numele butoanelor spune despre ce locație e vorba', async () => {
  renderPage()
  await screen.findByText('Bazin Audit Motion')
  expect(screen.getByRole('link', { name: 'Editează Bazin Audit Motion' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Activează Pin picker QA' })).toBeInTheDocument()
})

test('antetul arată câte locații are clubul', async () => {
  renderPage()
  // Numărul apare abia odată cu datele; titlul există de la prima randare.
  await screen.findByText('Bazin Audit Motion')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('(2)')
})

// Criteriul 14 + numărul de cursuri de pe card, cu acordul la număr.
test('cardul spune câte cursuri se țin acolo, doar când există', async () => {
  renderPage()
  const cardActiv = (await screen.findByText('Bazin Audit Motion')).closest('div')!
  expect(within(cardActiv).getByText('1 curs aici')).toBeInTheDocument()
  expect(screen.queryByText('0 cursuri aici')).not.toBeInTheDocument()
})
