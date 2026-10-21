import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { CheckoutRulesConsent, type OfferingRules } from './CheckoutRulesConsent'

function renderConsent(rules: OfferingRules | undefined, onCheckedChange = vi.fn()) {
  render(
    <MemoryRouter>
      <CheckoutRulesConsent
        kind="CAMP"
        title="Tabără de munte"
        rules={rules}
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    </MemoryRouter>,
  )
  return onCheckedChange
}

test('regulamentul din fișier se deschide într-un tab nou, fără să părăsească checkoutul', () => {
  renderConsent({
    text: null,
    file: {
      url: 'https://cdn.test/camp-rules/r.pdf',
      name: 'regulament.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    },
  })
  const link = screen.getByRole('link', { name: 'Deschide regulamentul taberei: regulament.pdf' })
  expect(link).toHaveAttribute('href', 'https://cdn.test/camp-rules/r.pdf')
  expect(link).toHaveAttribute('target', '_blank')
  expect(screen.getByText(/accept regulamentul taberei și/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'termenii și condițiile' })).toHaveAttribute('target', '_blank')
})

test('regulamentul scris ca text se citește într-un panou, iar bifa rămâne nebifată', async () => {
  const onChange = renderConsent({ text: 'Copiii ajung la 8:30.', file: null })
  await userEvent.click(screen.getByRole('button', { name: 'Citește regulamentul taberei' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Copiii ajung la 8:30.')
  expect(onChange).not.toHaveBeenCalled()
})

test('fără regulament, fraza cere doar acceptarea termenilor', () => {
  renderConsent({ text: null, file: null })
  expect(screen.queryByText(/regulamentul/)).not.toBeInTheDocument()
  expect(screen.getByText(/accept/)).toHaveTextContent('Confirm suma finală în lei și accept termenii și condițiile.')
})
