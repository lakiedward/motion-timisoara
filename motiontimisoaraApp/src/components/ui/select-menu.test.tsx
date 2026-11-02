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
