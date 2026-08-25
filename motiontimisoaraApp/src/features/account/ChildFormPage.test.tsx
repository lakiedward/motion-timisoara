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

// Regresie (secțiunea UI #447): valoarea cu diacritice din baza de date nu se
// potrivea cu nicio opțiune, selectul rămânea fără selecție și prima salvare
// ștergea nivelul.
test('nivelul scris cu diacritice apare ales în listă', async () => {
  renderForm()
  // Întâi datele: selectul există de la prima randare, gol, iar `reset` îl umple abia
  // după ce ajunge copilul — o citire prea devreme ar trece și pe codul stricat.
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
    expect(mockedUpdate).toHaveBeenCalledWith(COPIL_ID, expect.objectContaining({ level: 'incepator' })),
  )
})

// Un nivel pe care nu-l recunoaștem nu are voie să dispară din listă: altfel
// selectul ar cădea pe „—” și salvarea l-ar șterge. Același tipar ca la locația
// dezactivată păstrată în lista de cursuri a clubului.
test('un nivel necunoscut rămâne în listă și nu se pierde la salvare', async () => {
  const user = userEvent.setup()
  mockedGet.mockResolvedValue({ ...copil, level: 'expert' } as never)
  renderForm()
  await screen.findByDisplayValue('Andrei Popescu')
  const nivel = screen.getByLabelText('Nivel') as HTMLSelectElement
  expect(nivel.value).toBe('expert')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith(COPIL_ID, expect.objectContaining({ level: 'expert' })),
  )
})

// Regresie (findings #62 și #129): un id inexistent randa „Editează copil” cu un
// formular gol și buton Salvează, deci părintele completa date degeaba.
test('un copil inexistent arată mesaj, nu un formular gol', async () => {
  mockedGet.mockResolvedValue(null)
  renderForm()
  expect(await screen.findByText('Copilul nu a fost găsit.')).toBeInTheDocument()
  expect(screen.queryByLabelText(/Nume/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
})

// Un id care nu e nici măcar un uuid nu are ce potrivi, deci nici nu se cere
// serverului: cererea ar pica cu 400 și ar lăsa o eroare în consolă degeaba.
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

// Criteriul #196 al secțiunii #548 era aprobat din 11 august, dar nu fusese
// construit niciodată: se salva un copil fără niciun contact de urgență.
test('fără contact de urgență salvarea e oprită', async () => {
  const user = userEvent.setup()
  renderForm('/account/child/new')
  await user.type(await screen.findByLabelText(/Nume/), 'Copil Nou')
  await user.type(screen.getByLabelText(/Data nașterii/), '2016-05-10')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  expect(await screen.findByText('Obligatoriu')).toBeInTheDocument()
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

// „0722 123 456” e un număr scris de om, nu unul invalid.
test('un telefon scris cu spații e acceptat', async () => {
  const user = userEvent.setup()
  renderForm('/account/child/new')
  await user.type(await screen.findByLabelText(/Nume/), 'Copil Nou')
  await user.type(screen.getByLabelText(/Data nașterii/), '2016-05-10')
  await user.type(screen.getByLabelText(/Contact urgență/), 'Ion Popescu')
  await user.type(screen.getByLabelText(/Telefon urgență/), '0722 123 456')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  await waitFor(() =>
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ emergency_phone: '0722 123 456' }),
    ),
  )
})

// Criteriul #195, la fel: se salva o dată din viitor, iar copilul apărea în listă
// cu vârstă negativă.
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

// Criteriile #197 și #198, tot neconstruite: aici se scrie medicație, iar
// părintele trebuie să vadă dintr-o privire tot ce a scris.
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
