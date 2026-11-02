import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import AccountDeletionPage from './AccountDeletionPage'

test('pagina publică explică pașii, ce se șterge și ce rămâne', () => {
  render(
    <MemoryRouter>
      <AccountDeletionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Ștergerea contului' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Intră în cont și șterge-l' })).toHaveAttribute(
    'href',
    '/account/profile#sterge-contul',
  )
  expect(screen.getByRole('heading', { name: /Ce se șterge/ })).toBeInTheDocument()
  expect(screen.getByText(/Plățile făcute și facturile/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'pagina de contact' })).toHaveAttribute(
    'href',
    '/contact',
  )
})
