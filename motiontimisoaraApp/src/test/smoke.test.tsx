import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '@/features/public/HomePage'

test('home page renders the hero heading', () => {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  )
  expect(screen.getByRole('heading', { name: /campionii de mâine/i })).toBeInTheDocument()
})
