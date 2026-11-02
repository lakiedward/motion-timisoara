import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

test('focusul intră în dialog la deschidere', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Închide poza' })).toHaveFocus())
})

test('Tab nu scapă din dialog și trece prin toate butoanele lui', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  const dialog = screen.getByRole('dialog')
  const inchide = screen.getByRole('button', { name: 'Închide poza' })
  await waitFor(() => expect(inchide).toHaveFocus())

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

test('butonul de închidere poartă tiparul de atingere al casei', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  expect(screen.getByRole('button', { name: 'Închide poza' }).className).toContain(
    'size-touch-target',
  )
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

test('apăsarea unei săgeți nu închide dialogul', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

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
  expect(screen.getByRole('button', { name: 'Poza următoare' }).className).toContain(
    'size-touch-target',
  )
  expect(screen.getByRole('button', { name: 'Poza anterioară' }).className).toContain(
    'size-touch-target',
  )
})

const MULTE = Array.from({ length: 11 }, (_, i) => `https://p/m${i + 1}.jpg`)

test('sub prag nu apare niciun buton de „vezi mai mult”', () => {
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  expect(screen.queryByRole('button', { name: /Vezi/ })).not.toBeInTheDocument()
})

test('șapte sau opt poze se văd întregi de la tabletă, butonul apare doar pe telefon', () => {
  render(<PhotoGallery urls={MULTE.slice(0, 8)} alt="Tabără" />)
  const miniaturi = screen.getAllByRole('listitem')
  expect(miniaturi).toHaveLength(8)
  expect(miniaturi.filter((li) => li.className.includes('max-sm:hidden'))).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Vezi toate cele 8 poze' }).className).toContain(
    'sm:hidden',
  )
})

test('până la șase poze nu apare butonul nici pe telefon', () => {
  render(<PhotoGallery urls={MULTE.slice(0, 6)} alt="Tabără" />)
  expect(screen.queryByRole('button', { name: /Vezi/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('listitem').some((li) => li.className.includes('max-sm:hidden'))).toBe(
    false,
  )
})

test('peste prag arată opt miniaturi și un buton care spune câte sunt', () => {
  render(<PhotoGallery urls={MULTE} alt="Tabără" />)
  expect(screen.getAllByRole('button', { name: /Deschide poza/ })).toHaveLength(8)
  expect(screen.getByRole('button', { name: 'Vezi toate cele 11 poze' })).toBeInTheDocument()
})

test('butonul desface grila și o strânge la loc', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={MULTE} alt="Tabără" />)

  await user.click(screen.getByRole('button', { name: 'Vezi toate cele 11 poze' }))
  expect(screen.getAllByRole('button', { name: /Deschide poza/ })).toHaveLength(11)

  const strange = screen.getByRole('button', { name: 'Vezi mai puține' })
  expect(strange).toHaveAttribute('aria-expanded', 'true')
  await user.click(strange)
  expect(screen.getAllByRole('button', { name: /Deschide poza/ })).toHaveLength(8)
})

test('numărătoarea miniaturilor spune totalul, nu cât se vede', () => {
  render(<PhotoGallery urls={MULTE} alt="Tabără" />)
  expect(screen.getByRole('button', { name: 'Deschide poza 8 din 11' })).toBeInTheDocument()
})

test('cu grila strânsă, săgeata trece și prin pozele neafișate', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={MULTE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 8 din 11' }))

  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 9 din 11' })).toBeInTheDocument()
})

test('butonul de „vezi mai mult” poartă tiparul de atingere al casei', () => {
  render(<PhotoGallery urls={MULTE} alt="Tabără" />)
  expect(screen.getByRole('button', { name: 'Vezi toate cele 11 poze' }).className).toContain(
    'h-11',
  )
})

test('fiecare miniatură arată poza ei, în ordinea primită', () => {
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  const surse = screen
    .getAllByRole('button')
    .map((b) => b.querySelector('img')?.getAttribute('src'))
  expect(surse).toEqual(POZE)
})

test('desfăcută, grila arată toate pozele și pe telefon', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={MULTE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Vezi toate cele 11 poze' }))
  expect(screen.getAllByRole('listitem').some((li) => li.className.includes('max-sm:hidden'))).toBe(
    false,
  )
})

test('în poza mărită se vede poziția din total', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 2 din 3' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('2 / 3')
  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('3 / 3')
})

test('glisarea spre stânga trece la poza următoare, spre dreapta la cea anterioară', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  const dialog = screen.getByRole('dialog')

  fireEvent.touchStart(dialog, {
    touches: [{ clientX: 300, clientY: 0 }],
    changedTouches: [{ clientX: 300, clientY: 0 }],
  })
  fireEvent.touchEnd(dialog, {
    touches: [{ clientX: 100, clientY: 0 }],
    changedTouches: [{ clientX: 100, clientY: 0 }],
  })
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 2 din 3' })).toBeInTheDocument()

  fireEvent.touchStart(dialog, {
    touches: [{ clientX: 100, clientY: 0 }],
    changedTouches: [{ clientX: 100, clientY: 0 }],
  })
  fireEvent.touchEnd(dialog, {
    touches: [{ clientX: 300, clientY: 0 }],
    changedTouches: [{ clientX: 300, clientY: 0 }],
  })
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 1 din 3' })).toBeInTheDocument()
})

test('o atingere scurtă nu schimbă poza', async () => {
  const user = userEvent.setup()
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.touchStart(dialog, {
    touches: [{ clientX: 200, clientY: 0 }],
    changedTouches: [{ clientX: 200, clientY: 0 }],
  })
  fireEvent.touchEnd(dialog, {
    touches: [{ clientX: 180, clientY: 0 }],
    changedTouches: [{ clientX: 180, clientY: 0 }],
  })
  expect(screen.getByRole('dialog', { name: 'Tabără — poza 1 din 3' })).toBeInTheDocument()
})

test('poza mărită se deschide în portalul dialogurilor, deasupra meniului', async () => {
  const user = userEvent.setup()
  const { container } = render(<PhotoGallery urls={POZE} alt="Tabără" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3' }))
  const dialog = screen.getByRole('dialog')
  expect(container).not.toContainElement(dialog)
  expect(dialog.className).toContain('z-50')
})

test('o poză care nu se încarcă lasă pătratul gol, fără să strice grila', () => {
  render(<PhotoGallery urls={POZE} alt="Tabără" />)
  const buton = screen.getByRole('button', { name: 'Deschide poza 2 din 3' })
  fireEvent.error(buton.querySelector('img')!)
  expect(buton.querySelector('img')).toBeNull()
  expect(buton.className).toContain('aspect-square')
  expect(buton.className).toContain('bg-muted')
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})
