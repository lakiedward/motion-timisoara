import { render, screen } from '@testing-library/react'
import App from '@/App'

test('renders the brand heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Motion Timisoara' })).toBeInTheDocument()
})
