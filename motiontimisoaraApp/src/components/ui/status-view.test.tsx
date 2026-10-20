import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { StatusView } from './status-view'

test('the success state announces its title with the success ink icon', () => {
  render(<StatusView state="success" title="Plată confirmată" text="Înscrierea este activă." />)
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Plată confirmată')
  expect(status.querySelector('.text-success-ink')).not.toBeNull()
  expect(status).not.toHaveClass('border-dashed')
})

test('the empty state keeps its dashed frame and no live role', () => {
  const { container } = render(<StatusView state="empty" />)
  expect(container.firstElementChild).toHaveClass('border-dashed')
  expect(screen.queryByRole('status')).toBeNull()
})
