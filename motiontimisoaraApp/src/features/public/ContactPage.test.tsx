import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ContactPage from './ContactPage'
import { submitContactForm } from '@/api/public'

vi.mock('@/api/public', () => ({ submitContactForm: vi.fn() }))

const mocked = vi.mocked(submitContactForm)

beforeEach(() => {
  mocked.mockReset()
})

async function completeaza() {
  const user = userEvent.setup()
  render(<ContactPage />)
  await user.type(screen.getByLabelText('Nume'), 'Ana Pop')
  await user.type(screen.getByLabelText('Email'), 'ana@example.com')
  await user.type(screen.getByLabelText('Mesaj'), 'Vreau detalii despre cursul de înot.')
  return user
}

test('o trimitere eșuată nu arată succes și păstrează mesajul în formular', async () => {
  mocked.mockRejectedValue(new Error('Edge Function returned a non-2xx status code'))
  const user = await completeaza()
  await user.click(screen.getByRole('button', { name: 'Trimite mesajul' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut trimite mesajul.')
  expect(screen.queryByText(/Mulțumim!/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('Mesaj')).toHaveValue('Vreau detalii despre cursul de înot.')
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeEnabled()
})

test('după o eroare, reîncercarea reușită arată confirmarea', async () => {
  mocked.mockRejectedValueOnce(new Error('retea picata')).mockResolvedValueOnce(undefined)
  const user = await completeaza()
  await user.click(screen.getByRole('button', { name: 'Trimite mesajul' }))
  await user.click(await screen.findByRole('button', { name: 'Reîncearcă' }))

  expect(await screen.findByText(/Mulțumim! Mesajul tău a fost trimis/)).toBeInTheDocument()
  expect(mocked).toHaveBeenCalledTimes(2)
  expect(mocked).toHaveBeenLastCalledWith({
    name: 'Ana Pop',
    email: 'ana@example.com',
    subject: '',
    message: 'Vreau detalii despre cursul de înot.',
  })
})
