import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SelectMenu } from './select-menu'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <span id="lbl">Club</span>
      <SelectMenu
        id="club"
        name="club"
        aria-labelledby="lbl club"
        aria-invalid={value === 'x'}
        value={value}
        onValueChange={setValue}
        emptyLabel="Fără club"
        options={[{ value: 'a', label: 'Club A' }]}
        groups={[
          {
            label: 'Arhivate',
            options: [
              { value: 'b', label: 'Club B' },
              { value: 'c', label: 'Club C', disabled: true },
            ],
          },
        ]}
      />
    </>
  )
}

test('shows the empty label, opens a styled list with groups and picks an option', async () => {
  const user = userEvent.setup()
  const { container } = render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Club Fără club' })
  await user.click(trigger)
  expect(screen.getByText('Arhivate')).toBeInTheDocument()
  expect(screen.getByRole('menuitemradio', { name: 'Fără club' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(screen.getByRole('menuitemradio', { name: 'Club C' })).toHaveAttribute(
    'data-disabled',
  )
  await user.click(screen.getByRole('menuitemradio', { name: 'Club B' }))
  expect(screen.getByRole('button', { name: 'Club Club B' })).toBeInTheDocument()
  expect(container.querySelector('input[name="club"]')).toHaveValue('b')
})

test('works from the keyboard', async () => {
  const user = userEvent.setup()
  render(<Harness initial="a" />)
  screen.getByRole('button', { name: 'Club Club A' }).focus()
  await user.keyboard('{Enter}')
  await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
  expect(screen.getByRole('button', { name: /^Club / })).toHaveTextContent(/Club/)
  await user.keyboard('{Escape}')
})

function SearchHarness() {
  const [value, setValue] = useState('')
  return (
    <>
      <label htmlFor="county">Județ</label>
      <SelectMenu
        id="county"
        searchable
        value={value}
        onValueChange={setValue}
        placeholder="Alege județul"
        options={[
          { value: 'Arad', label: 'Arad' },
          { value: 'Timiș', label: 'Timiș' },
          { value: 'Bistrița-Năsăud', label: 'Bistrița-Năsăud' },
        ]}
      />
    </>
  )
}

test('filters long lists by typing without diacritics and picks a match', async () => {
  const user = userEvent.setup()
  render(<SearchHarness />)
  await user.click(screen.getByRole('button', { name: 'Județ' }))
  const search = screen.getByRole('searchbox', { name: 'Caută…' })
  await user.type(search, 'timis')
  expect(search).toHaveValue('timis')
  expect(screen.queryByRole('menuitemradio', { name: 'Arad' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('menuitemradio', { name: 'Timiș' }))
  expect(screen.getByRole('button', { name: 'Județ' })).toHaveTextContent('Timiș')
})

test('shows a no-results message and clears the search when reopened', async () => {
  const user = userEvent.setup()
  render(<SearchHarness />)
  await user.click(screen.getByRole('button', { name: 'Județ' }))
  await user.type(screen.getByRole('searchbox'), 'zzz')
  expect(screen.getByRole('status')).toHaveTextContent('Niciun rezultat')
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Județ' }))
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(3)
})
