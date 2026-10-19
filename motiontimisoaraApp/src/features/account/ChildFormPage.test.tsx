import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import ChildFormPage from './ChildFormPage'
import { createChild, getChild, updateChild } from '@/api/account'

vi.mock('@/api/account', () => ({
  getChild: vi.fn(),
  createChild: vi.fn(),
  updateChild: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedGet = vi.mocked(getChild)
const mockedUpdate = vi.mocked(updateChild)
const mockedCreate = vi.mocked(createChild)

const COPIL_ID = 'ce7a424e-85d8-40cf-9565-983eb2929cb5'

const copil = {
  id: COPIL_ID,
  name: 'Andrei Popescu',
  birth_date: '2016-03-12',
  level: 'începător',
  allergies: null,
  emergency_contact_name: 'Ion Popescu',
  emergency_phone: '0722123456',
  secondary_contact_name: null,
  secondary_phone: null,
  tshirt_size: null,
  photo_consent: true,
  pickup_persons: null,
  swim_level: null,
  medical_notes: null,
  dietary_restrictions: null,
}

function renderForm(ruta = `/account/child/${COPIL_ID}`) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/account/children" element={<p>Lista de copii</p>} />
          <Route path="/account/child/new" element={<ChildFormPage />} />
          <Route path="/account/child/:id" element={<ChildFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGet.mockResolvedValue(copil as never)
  mockedUpdate.mockResolvedValue(copil as never)
  mockedCreate.mockResolvedValue(copil as never)
})

test('nivelul scris cu diacritice apare ales în listă', async () => {
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  const nivel = screen.getByLabelText('Nivel') as HTMLSelectElement
  expect(nivel.value).toBe('incepator')
  expect(nivel.selectedOptions[0].textContent).toBe('Începător')
})

test('salvarea scrie forma canonică a nivelului, nu cea cu diacritice', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith(
      COPIL_ID,
      expect.objectContaining({ level: 'incepator' }),
    ),
  )
})

test('un nivel necunoscut rămâne în listă și nu se pierde la salvare', async () => {
  const user = userEvent.setup()
  mockedGet.mockResolvedValue({ ...copil, level: 'expert' } as never)
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  const nivel = screen.getByLabelText('Nivel') as HTMLSelectElement
  expect(nivel.value).toBe('expert')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith(
      COPIL_ID,
      expect.objectContaining({ level: 'expert' }),
    ),
  )
})

test('un copil inexistent arată mesaj, nu un formular gol', async () => {
  mockedGet.mockResolvedValue(null)
  renderForm()
  expect(await screen.findByText('Copilul nu a fost găsit.')).toBeInTheDocument()
  expect(screen.queryByLabelText(/Nume/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
})

test('un id malformat nu ajunge la server', async () => {
  renderForm('/account/child/id-inexistent-123')
  expect(await screen.findByText('Copilul nu a fost găsit.')).toBeInTheDocument()
  expect(mockedGet).not.toHaveBeenCalled()
})

test('o citire căzută arată eroare cu Reîncearcă, nu „nu a fost găsit”', async () => {
  mockedGet.mockRejectedValue(new Error('network'))
  renderForm()
  expect(await screen.findByText('Nu am putut încărca copilul.')).toBeInTheDocument()
  expect(screen.queryByText('Copilul nu a fost găsit.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('fără contact de urgență salvarea e oprită', async () => {
  const user = userEvent.setup()
  renderForm('/account/child/new')
  await user.type(await screen.findByLabelText(/Nume/), 'Copil Nou')
  await user.type(screen.getByLabelText(/Data nașterii/), '2016-05-10')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  expect(await screen.findAllByText('Obligatoriu')).toHaveLength(2)
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('un telefon de urgență care nu e număr e refuzat', async () => {
  const user = userEvent.setup()
  renderForm('/account/child/new')
  await user.type(await screen.findByLabelText(/Nume/), 'Copil Nou')
  await user.type(screen.getByLabelText(/Data nașterii/), '2016-05-10')
  await user.type(screen.getByLabelText(/Contact urgență/), 'Ion Popescu')
  await user.type(screen.getByLabelText(/Telefon urgență/), 'abc')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  expect(await screen.findByText('Număr de telefon invalid')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('un telefon scris cu spații e acceptat', async () => {
  const user = userEvent.setup()
  renderForm('/account/child/new')
  await user.type(await screen.findByLabelText(/Nume/), 'Copil Nou')
  await user.type(screen.getByLabelText(/Data nașterii/), '2016-05-10')
  await user.type(screen.getByLabelText(/Contact urgență/), 'Ion Popescu')
  await user.type(screen.getByLabelText(/Telefon urgență/), '0722 123 456')
  await user.click(screen.getByLabelText('Da, poate apărea'))
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  await waitFor(() =>
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ emergency_phone: '0722 123 456' }),
    ),
  )
})

test('o dată de naștere din viitor e refuzată', async () => {
  const user = userEvent.setup()
  renderForm('/account/child/new')
  await user.type(await screen.findByLabelText(/Nume/), 'Copil Nou')
  await user.type(screen.getByLabelText(/Data nașterii/), '2030-01-01')
  await user.type(screen.getByLabelText(/Contact urgență/), 'Ion Popescu')
  await user.type(screen.getByLabelText(/Telefon urgență/), '0722123456')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  expect(await screen.findByText('Data nu poate fi în viitor')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('alergiile se scriu într-o casetă pe mai multe rânduri', async () => {
  renderForm()
  const alergii = await screen.findByLabelText('Alergii / observații')
  expect(alergii.tagName).toBe('TEXTAREA')
})

test('câmpurile obligatorii se văd ca atare înainte de salvare', async () => {
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  expect(screen.getByText(/Câmpurile marcate cu/)).toBeInTheDocument()
  for (const eticheta of ['Nume', 'Data nașterii', 'Contact urgență', 'Telefon urgență']) {
    expect(screen.getByText(eticheta).textContent).toContain('*')
  }
})

test('un câmp obligatoriu gol spune „Obligatoriu”, nu „Minim 2 caractere”', async () => {
  const user = userEvent.setup()
  renderForm('/account/child/new')
  await user.click(await screen.findByRole('button', { name: 'Salvează' }))

  expect(await screen.findAllByText('Obligatoriu')).toHaveLength(4)
  expect(screen.queryByText('Minim 2 caractere')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/Nume/)).toHaveAttribute('aria-describedby', 'name-error')
})

test('data de azi e acceptată și după miezul nopții ora României', async () => {
  const tz = process.env.TZ
  process.env.TZ = 'Europe/Bucharest'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-18T21:30:00Z'))
  try {
    const user = userEvent.setup()
    renderForm('/account/child/new')
    await user.type(await screen.findByLabelText(/Nume/), 'Copil Nou')
    await user.type(screen.getByLabelText(/Data nașterii/), '2026-10-19')
    await user.type(screen.getByLabelText(/Contact urgență/), 'Ion Popescu')
    await user.type(screen.getByLabelText(/Telefon urgență/), '0722123456')
    await user.click(screen.getByLabelText('Da, poate apărea'))
    await user.click(screen.getByRole('button', { name: 'Salvează' }))

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ birth_date: '2026-10-19' }),
      ),
    )
  } finally {
    vi.useRealTimers()
    process.env.TZ = tz
  }
})

test('la editare, linkul Cod QR duce la codul aceluiași copil', async () => {
  renderForm()
  const link = await screen.findByRole('link', { name: 'Cod QR' })
  expect(link).toHaveAttribute('href', `/account/child/${COPIL_ID}/qr`)
})

test('linkul Cod QR lipsește pe copil nou, pe copil negăsit și pe eroare', async () => {
  const { unmount } = renderForm('/account/child/new')
  await screen.findByLabelText(/Nume/)
  expect(screen.queryByRole('link', { name: 'Cod QR' })).not.toBeInTheDocument()
  unmount()

  mockedGet.mockResolvedValueOnce(null)
  const negasit = renderForm()
  await screen.findByText('Copilul nu a fost găsit.')
  expect(screen.queryByRole('link', { name: 'Cod QR' })).not.toBeInTheDocument()
  negasit.unmount()

  mockedGet.mockRejectedValueOnce(new Error('network'))
  renderForm()
  await screen.findByText('Nu am putut încărca copilul.')
  expect(screen.queryByRole('link', { name: 'Cod QR' })).not.toBeInTheDocument()
})

test('cât se încarcă copilul nu apare un formular gol', async () => {
  mockedGet.mockReturnValue(new Promise(() => {}))
  renderForm()
  expect(await screen.findByRole('status', { name: 'Se încarcă copilul' })).toBeInTheDocument()
  expect(screen.queryByLabelText(/Nume/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
})

test('formularul e împărțit în grupuri cu titlu', async () => {
  renderForm('/account/child/new')
  await screen.findByLabelText(/Nume/)
  for (const titlu of ['Despre copil', 'Sănătate', 'Persoane de contact', 'Acord foto și video']) {
    expect(screen.getByText(titlu)).toBeInTheDocument()
  }
  expect(screen.getByRole('heading', { name: 'Urgență' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Secundar (opțional)' })).toBeInTheDocument()
})

test('acordul foto e obligatoriu, iar un copil vechi fără răspuns trebuie să aleagă', async () => {
  const user = userEvent.setup()
  mockedGet.mockResolvedValue({ ...copil, photo_consent: null } as never)
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  expect(screen.getByLabelText('Da, poate apărea')).not.toBeChecked()
  expect(screen.getByLabelText('Nu, fără poze și video cu copilul')).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Alege una dintre variante')).toBeInTheDocument()
  expect(mockedUpdate).not.toHaveBeenCalled()
})

test('acordul, înotul, cine ridică, sănătatea și mâncarea se salvează în forma din baza de date', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  expect(screen.getByLabelText('Da, poate apărea')).toBeChecked()
  await user.click(screen.getByLabelText('Nu, fără poze și video cu copilul'))
  await user.selectOptions(screen.getByLabelText('Știe să înoate?'), 'Puțin')
  await user.type(screen.getByLabelText('Cine poate ridica copilul'), '  Maria Pop, bunica  ')
  await user.type(screen.getByLabelText('Afecțiuni și medicație'), ' Astm, inhalator ')
  await user.type(screen.getByLabelText('Restricții alimentare'), 'Fără lactoză ')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith(
      COPIL_ID,
      expect.objectContaining({
        photo_consent: false,
        swim_level: 'basic',
        pickup_persons: 'Maria Pop, bunica',
        medical_notes: 'Astm, inhalator',
        dietary_restrictions: 'Fără lactoză',
      }),
    ),
  )
})

test('câmpurile opționale lăsate goale se salvează ca lipsă, nu ca text gol', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith(
      COPIL_ID,
      expect.objectContaining({
        photo_consent: true,
        swim_level: null,
        pickup_persons: null,
        medical_notes: null,
        dietary_restrictions: null,
      }),
    ),
  )
})
