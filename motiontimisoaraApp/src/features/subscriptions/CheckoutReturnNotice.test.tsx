import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CheckoutReturnNotice } from './CheckoutReturnNotice'

const KEYS = [['my-subscription']]

function Location() {
  const location = useLocation()
  return <p data-testid="search">{location.search}</p>
}

function renderAt(url: string, client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <CheckoutReturnNotice queryKeys={KEYS} />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('a successful return shows the notice, clears the URL and refreshes for a while', async () => {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  renderAt('/club/abonament?abonament=reusit&session_id=cs_test_1', client)
  expect(screen.getByTestId('checkout-return-success')).toBeTruthy()
  expect(screen.getByTestId('search').textContent).toBe('')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(21_000)
  })
  expect(invalidate).toHaveBeenCalledTimes(5)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-subscription'] })
})

test('a cancelled return says nothing was charged', () => {
  renderAt('/club/abonament?abonament=anulat')
  expect(screen.getByTestId('checkout-return-canceled')).toBeTruthy()
  expect(screen.getByTestId('search').textContent).toBe('')
})

test('no or unknown parameter renders nothing', () => {
  const { container } = renderAt('/club/abonament?abonament=altceva')
  expect(container.querySelector('[role="status"]')).toBeNull()
})
