import { render, screen } from '@testing-library/react'
import HomePage from '@/features/public/HomePage'

test('home page renders the brand heading', () => {
  render(<HomePage />)
  expect(screen.getByRole('heading', { name: 'Motion Timisoara' })).toBeInTheDocument()
})
