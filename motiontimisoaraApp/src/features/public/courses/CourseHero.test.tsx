import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { CourseHero } from './CourseHero'

const sport = { code: 'SWIMMING', name: 'Înot' }

function renderHero(photoUrl: string | null, levelLabel: string | null = 'Începător') {
  return render(
    <MemoryRouter>
      <CourseHero name="Înot copii" photoUrl={photoUrl} sport={sport} levelLabel={levelLabel} />
    </MemoryRouter>,
  )
}

test('cu fotografie, hero-ul arată poza, badge-urile și titlul peste ea', () => {
  const { container } = renderHero('https://example.com/poza.jpg')
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/poza.jpg')
  expect(screen.getByRole('heading', { level: 1, name: 'Înot copii' })).toBeInTheDocument()
  expect(screen.getByText('Înot')).toBeInTheDocument()
  expect(screen.getByText('Începător')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înapoi la cursuri/ })).toHaveAttribute('href', '/cursuri')
})

test('fără fotografie, hero-ul arată ilustrația sportului cu numele lui și păstrează badge-urile', () => {
  const { container } = renderHero(null)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByRole('img', { name: 'Ilustrație Înot' })).toBeInTheDocument()
  expect(screen.getByText('Începător')).toBeInTheDocument()
})

test('o fotografie care nu se încarcă trece pe ilustrația sportului', () => {
  const { container } = renderHero('https://example.com/lipsa.jpg')
  fireEvent.error(container.querySelector('img')!)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByRole('img', { name: 'Ilustrație Înot' })).toBeInTheDocument()
})
