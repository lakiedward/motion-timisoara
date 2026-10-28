import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import type { BillingDetails } from '@/api/checkout'
import { CheckoutBillingFields } from './CheckoutBillingFields'

function Harness() {
  const [billing, setBilling] = useState<BillingDetails>({
    name: 'Ana Pop',
    email: 'ana@example.com',
    addressLine1: '',
    city: '',
    postalCode: '',
  })
  return <CheckoutBillingFields billing={billing} setBilling={setBilling} />
}

test('every billing field is named by its visible label', () => {
  render(<Harness />)
  expect(screen.getByRole('textbox', { name: 'Nume complet' })).toHaveValue('Ana Pop')
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('ana@example.com')
  expect(screen.getByRole('textbox', { name: 'Adresă' })).toHaveAttribute(
    'autocomplete',
    'address-line1',
  )
  expect(screen.getByRole('textbox', { name: 'Oraș' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Cod poștal' })).toBeInTheDocument()
})

test('clicking a label focuses its field', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByText('Oraș'))
  expect(screen.getByRole('textbox', { name: 'Oraș' })).toHaveFocus()
  await user.keyboard('Timișoara')
  expect(screen.getByRole('textbox', { name: 'Oraș' })).toHaveValue('Timișoara')
})
