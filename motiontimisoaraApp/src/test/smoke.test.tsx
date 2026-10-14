import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from '@/features/public/HomePage'

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: null, loading: false }) }))

test('home page renders the hero heading', () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  expect(screen.getByRole('heading', { level: 1, name: /sportul potrivit/i })).toBeInTheDocument()
})
