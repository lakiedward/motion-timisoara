import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { campRulesSummary } from '@/lib/camp-rules'
import { CampRulesCard } from './CampRulesCard'

const fisier = {
  name: 'regulament.pdf',
  contentType: 'application/pdf',
  sizeBytes: 2048,
  url: 'https://semnat/regulament.pdf',
}

test('fără text și fără fișier cardul lipsește', () => {
  const { container } = render(<CampRulesCard rules="   " fisier={null} />)
  expect(container).toBeEmptyDOMElement()
})

test('cardul e închis la intrare și se deschide cu textul exact și linkul', async () => {
  render(<CampRulesCard rules={'Fără telefoane.\nCasca e obligatorie.'} fisier={fisier} />)
  expect(screen.getByRole('heading', { name: 'Regulament' })).toBeInTheDocument()
  expect(screen.getByText('Text și PDF · 2 KB')).toBeInTheDocument()
  const buton = screen.getByRole('button', { name: 'Citește regulamentul' })
  expect(buton).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(/Fără telefoane/)).not.toBeInTheDocument()

  await userEvent.click(buton)
  expect(screen.getByRole('button', { name: 'Ascunde regulamentul' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  const text = screen.getByText(/Fără telefoane/)
  expect(text.textContent).toBe('Fără telefoane.\nCasca e obligatorie.')
  expect(text).toHaveClass('whitespace-pre-wrap')
  expect(text).not.toHaveClass('line-clamp-8')
  const link = screen.getByRole('link', { name: /regulament.pdf/ })
  expect(link).toHaveAttribute('href', fisier.url)
  expect(link).toHaveTextContent('Deschide regulamentul')

  await userEvent.click(screen.getByRole('button', { name: 'Ascunde regulamentul' }))
  expect(screen.queryByText(/Fără telefoane/)).not.toBeInTheDocument()
})

test('rezumatul spune ce conține regulamentul', () => {
  expect(campRulesSummary('Text', null)).toBe('Text scris de organizator')
  expect(campRulesSummary(null, fisier)).toBe('PDF · 2 KB')
  expect(campRulesSummary('Text', fisier)).toBe('Text și PDF · 2 KB')
})
