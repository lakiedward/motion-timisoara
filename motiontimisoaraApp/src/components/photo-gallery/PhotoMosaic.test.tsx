import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { PozaPublica } from '@/api/photo-gallery'
import { PhotoMosaic } from './PhotoMosaic'

function Mozaic({ photos, alt }: { photos: PozaPublica[]; alt: string }) {
  return (
    <PhotoMosaic
      photos={photos}
      alt={alt}
      title="O zi la curs"
      subtitle="Ce face copilul tău la antrenament, pas cu pas."
      sectionKey="course-gallery"
    />
  )
}

function poze(n: number): PozaPublica[] {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://p/${i + 1}.jpg`,
    caption: i === 0 ? 'Încălzirea pe mal' : null,
  }))
}

test('fără poze secțiunea nu apare', () => {
  const { container } = render(<Mozaic photos={[]} alt="Înot" />)
  expect(container).toBeEmptyDOMElement()
})

test('arată titlul, numărul de poze, descrierea și nota de acord', () => {
  render(<Mozaic photos={poze(2)} alt="Înot" />)
  const sectiune = screen.getByRole('region', { name: 'O zi la curs' })
  expect(within(sectiune).getByText('2 poze')).toBeInTheDocument()
  expect(within(sectiune).getByText('Încălzirea pe mal')).toBeInTheDocument()
  expect(
    within(sectiune).getByText('Poze încărcate de organizator, cu acordul scris al părinților.'),
  ).toBeInTheDocument()
})

test('cu mai mult de cinci poze, ultima dală spune câte mai sunt', () => {
  render(<Mozaic photos={poze(8)} alt="Înot" />)
  expect(screen.getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByText('+3 poze')).toBeInTheDocument()
  expect(screen.getByText('+5 poze')).toBeInTheDocument()
})

test('o singură poză în plus folosește singularul', () => {
  render(<Mozaic photos={poze(4)} alt="Înot" />)
  expect(screen.getByText('+1 poză')).toBeInTheDocument()
})

test('dala deschide poza mare, cu descrierea în titlul dialogului', async () => {
  const user = userEvent.setup()
  render(<Mozaic photos={poze(3)} alt="Înot începători" />)
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 3: Încălzirea pe mal' }))
  expect(
    screen.getByRole('dialog', { name: 'Înot începători — poza 1 din 3: Încălzirea pe mal' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Poza următoare' }))
  expect(screen.getByRole('dialog', { name: 'Înot începători — poza 2 din 3' })).toBeInTheDocument()
})
