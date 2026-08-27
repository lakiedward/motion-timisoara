import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PhotoGallery from './PhotoGallery'

const POZE = ['https://p/1.jpg', 'https://p/2.jpg', 'https://p/3.jpg']

test('fără poze nu randează nimic', () => {
  const { container } = render(<PhotoGallery urls={[]} alt="Tabără" />)
  expect(container).toBeEmptyDOMElement()
})

test('fiecare poză are un buton cu numele ei accesibil', () => {
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  expect(screen.getByRole('button', { name: 'Deschide poza 1 din 3' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deschide poza 3 din 3' })).toBeInTheDocument()
})

test('apăsarea deschide dialogul, cu eticheta care spune a câta e', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără de înot" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 2 din 3' }))
  expect(screen.getByRole('dialog', { name: 'Tabără de înot — poza 2 din 3' })).toBeInTheDocument()
})

// Era modal doar cu numele: Tab plimba focusul pe butoanele paginii de dedesubt,
// invizibile sub fundalul negru.
test('focusul intră în dialog la deschidere', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Închide poza' })).toHaveFocus(),
  )
})

test('Tab nu scapă din dialog și trece prin toate butoanele lui', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  const dialog = screen.getByRole('dialog')
  const inchide = screen.getByRole('button', { name: 'Închide poza' })
  await waitFor(() => expect(inchide).toHaveFocus())

  // Trei butoane înăuntru: închide, înapoi, înainte. La al patrulea Tab ciclul
  // se închide — și la fiecare pas focusul rămâne în dialog.
  const vazute: (string | null)[] = []
  for (let i = 0; i < 4; i += 1) {
    await user.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    vazute.push(document.activeElement?.getAttribute('aria-label') ?? null)
  }
  expect(vazute).toEqual(['Poza anterioară', 'Poza următoare', 'Închide poza', 'Poza anterioară'])
})

test('Shift+Tab merge înapoi, tot fără să iasă', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Închide poza' })).toHaveFocus())

  await user.tab({ shift: true })
  expect(screen.getByRole('button', { name: 'Poza următoare' })).toHaveFocus()
})

test('focusul se întoarce pe miniatura de unde s-a deschis', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  const miniatura = screen.getByRole('button', { name: 'Deschide poza 2 din 3' })
  await user.click(miniatura)
  await user.click(screen.getByRole('button', { name: 'Închide poza' }))
  expect(miniatura).toHaveFocus()
})

test('Escape închide dialogul', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// `(i - 1) % n` ar da -1 pe prima poză, iar `urls[-1]` e undefined — adică
// `<img src={undefined}>`, care cere pagina curenta de la server.
test('săgeata stânga pe prima poză sare la ultima, nu în gol', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await user.keyboard('{ArrowLeft}')
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 3 din 3' })).toBeInTheDocument()
})

test('săgeata dreapta pe ultima poză sare la prima', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 3 din 3' }))
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 1 din 3' })).toBeInTheDocument()
})

// Lista se poate scurta cat timp o poza e deschisa (refetch, stergere).
test('dacă lista se scurtează sub poza deschisă, dialogul se închide', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 3 din 3' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  rerender(<PhotoGallery urls={POZE.slice(0, 1)} alt="Tabără" />)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('apăsarea pe fundal închide, apăsarea pe poză nu', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))

  const dialog = screen.getByRole('dialog')
  await user.click(dialog.querySelector('img')!)
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  await user.click(dialog)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// jsdom n-are layout, deci pragul de atingere se verifică pe clasă: `size-11` e
// 2.75rem, adică 44px. Înălțimile reale s-au măsurat în browser.
test('butonul de închidere poartă tiparul de atingere al casei', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  expect(screen.getByRole('button', { name: 'Închide poza' }).className).toContain('size-11')
})

test('săgețile de pe ecran umblă prin poze, în ambele sensuri', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))

  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 2 din 3' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Poza anterioară' }))
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 1 din 3' })).toBeInTheDocument()
})

// Săgețile stau peste fundalul care închide dialogul la clic.
test('apăsarea unei săgeți nu închide dialogul', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

// Efectul care duce focusul pe „Închide" era legat de indice, deci la fiecare
// pas smulgea focusul de pe săgeata tocmai apăsată.
test('focusul rămâne pe săgeată după ce umbli cu ea', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  const inainte = screen.getByRole('button', { name: 'Poza următoare' })

  await user.click(inainte)
  expect(inainte).toHaveFocus()
  await user.click(inainte)
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 3 din 3' })).toBeInTheDocument()
  expect(inainte).toHaveFocus()
})

test('săgețile ocolesc lista la capete', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await user.click(screen.getByRole('button', { name: 'Poza anterioară' }))
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 3 din 3' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 1 din 3' })).toBeInTheDocument()
})

test('cu o singură poză nu apar săgeți', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={[POZE[0]!]} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 1' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Poza următoare' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Poza anterioară' })).not.toBeInTheDocument()
})

test('săgețile poartă tiparul de atingere al casei', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  expect(screen.getByRole('button', { name: 'Poza următoare' }).className).toContain('size-11')
  expect(screen.getByRole('button', { name: 'Poza anterioară' }).className).toContain('size-11')
})

test('fiecare miniatură arată poza ei, în ordinea primită', () => {
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  const surse = screen.getAllByRole('button').map((b) => b.querySelector('img')?.getAttribute('src'))
  expect(surse).toEqual(POZE)
})
