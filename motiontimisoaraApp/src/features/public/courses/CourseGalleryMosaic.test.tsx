import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CourseGalleryMosaic, type CourseGalleryPhoto } from './CourseGalleryMosaic'

function poze(n: number): CourseGalleryPhoto[] {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://p/${i + 1}.jpg`,
    caption: i === 0 ? 'Încălzirea pe mal' : null,
  }))
}

test('fără poze secțiunea nu apare', () => {
  const { container } = render(<CourseGalleryMosaic photos={[]} courseName="Înot" />)
  expect(container).toBeEmptyDOMElement()
})

test('arată titlul, numărul de poze, descrierea și nota de acord', () => {
  render(<CourseGalleryMosaic photos={poze(2)} courseName="Înot" />)
  const sectiune = screen.getByRole('region', { name: 'O zi la curs' })
  expect(within(sectiune).getByText('2 poze')).toBeInTheDocument()
  expect(within(sectiune).getByText('Încălzirea pe mal')).toBeInTheDocument()
  expect(
    within(sectiune).getByText('Poze încărcate de organizator, cu acordul scris al părinților.'),
  ).toBeInTheDocument()
})

test('cu mai mult de cinci poze, ultima dală spune câte mai sunt', () => {
  render(<CourseGalleryMosaic photos={poze(8)} courseName="Înot" />)
  expect(screen.getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByText('+3 poze')).toBeInTheDocument()
  expect(screen.getByText('+5 poze')).toBeInTheDocument()
})

test('o singură poză în plus folosește singularul', () => {
  render(<CourseGalleryMosaic photos={poze(4)} courseName="Înot" />)
  expect(screen.getByText('+1 poză')).toBeInTheDocument()
})

test('dala deschide poza mare, cu descrierea în titlul dialogului', async () => {
  const user = userEvent.setup()
  render(<CourseGalleryMosaic photos={poze(3)} courseName="Înot începători" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3: Încălzirea pe mal' }))
  expect(
    screen.getByRole('dialog', { name: 'Înot începători — poza 1 din 3: Încălzirea pe mal' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog', { name: 'Înot începători — poza 2 din 3' })).toBeInTheDocument()
})
