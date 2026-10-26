import { render, screen } from '@testing-library/react'
import CampRulesDisplay from './CampRulesDisplay'

test('butonul pentru textul lung și linkul fișierului stau pe rânduri separate', () => {
  const lung = Array.from({ length: 12 }, (_, i) => `${i + 1}. Regula ${i + 1}.`).join('\n')
  render(
    <CampRulesDisplay
      rules={lung}
      fisier={{
        name: 'regulament.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        url: 'https://public/regulament.pdf',
      }}
    />,
  )
  const buton = screen.getByRole('button', { name: 'Arată tot regulamentul' })
  const link = screen.getByRole('link', { name: /regulament.pdf/ })
  expect(buton).toHaveClass('flex', 'w-fit')
  expect(buton).not.toHaveClass('inline-flex')
  expect(link).toHaveClass('flex', 'w-fit')
  expect(link).not.toHaveClass('inline-flex')
})
