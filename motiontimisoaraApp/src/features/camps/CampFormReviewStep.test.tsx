import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GOL, type Values } from './camp-form-schema'
import CampFormReviewStep from './CampFormReviewStep'

const valori = (extra: Partial<Values> = {}): Values => ({
  ...GOL,
  title: 'Tabără de înot',
  slug: 'tabara-de-inot',
  period_start: '2027-07-05',
  period_end: '2027-07-11',
  varste: [{ age_from: '7', age_to: '10', componente: [{ name: 'Participare', amount_lei: '0' }] }],
  ...extra,
})

test('Modifică duce la pasul cardului', async () => {
  const user = userEvent.setup()
  const onModifica = vi.fn()
  render(
    <CampFormReviewStep
      values={valori()}
      locatii={[]}
      fisierRegulament={null}
      onModifica={onModifica}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Modifică detalii' }))
  await user.click(screen.getByRole('button', { name: 'Modifică prețuri' }))
  expect(onModifica.mock.calls).toEqual([[0], [1]])
})

test('fără loc ales avertizează că tabăra nu apare pe hartă', () => {
  render(<CampFormReviewStep values={valori()} locatii={[]} fisierRegulament={null} />)
  expect(screen.getByText('Fără loc ales: tabăra nu apare pe hartă.')).toBeInTheDocument()
})

test('cu loc ales nu apare avertismentul', () => {
  render(
    <CampFormReviewStep
      values={valori({ location_id: 'loc-1' })}
      locatii={[{ id: 'loc-1', name: 'Bazin Olimpic', city: 'Timișoara' }]}
      fisierRegulament={null}
    />,
  )
  expect(screen.getByText('Bazin Olimpic · Timișoara')).toBeInTheDocument()
  expect(screen.queryByText(/Fără loc ales/)).not.toBeInTheDocument()
})

test('Gratuit apare o singură dată pe categorie, iar necesarul are numărul de articole', () => {
  render(
    <CampFormReviewStep
      values={valori({
        necesar: [
          {
            name: 'Haine',
            items: [
              { name: 'Tricou', quantity: '3' },
              { name: 'Șosete', quantity: '5' },
            ],
          },
        ],
        description: 'O săptămână la munte.',
        rules: 'Liniște după 22:00.',
      })}
      locatii={[]}
      fisierRegulament={null}
    />,
  )
  const categorie = screen.getAllByRole('listitem')[0]
  expect(within(categorie).getAllByText('Gratuit')).toHaveLength(2)
  expect(within(categorie).getByText('7–10 ani')).toBeInTheDocument()
  expect(screen.getByText('Haine (2)')).toBeInTheDocument()
  expect(screen.getByText('Descriere')).toBeInTheDocument()
  expect(screen.getByText('Regulament')).toBeInTheDocument()
})
