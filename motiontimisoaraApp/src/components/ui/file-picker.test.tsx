import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { Checkbox } from '@/components/ui/checkbox'
import { FilePicker } from '@/components/ui/file-picker'

function Harness() {
  const [file, setFile] = useState<File | null>(null)
  return (
    <FilePicker
      label="Fișier GPX"
      hint="Maximum 12 MB."
      accept=".gpx"
      file={file}
      chooseLabel="Alege fișierul GPX"
      onFileChange={setFile}
    />
  )
}

test('file picker hides the native control and shows the chosen file with a remove action', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const input = screen.getByLabelText('Fișier GPX')
  expect(input).toHaveClass('sr-only')
  expect(input).toHaveAccessibleDescription('Maximum 12 MB.')
  expect(screen.getByRole('button', { name: 'Alege fișierul GPX' })).toBeVisible()

  await user.upload(input, new File(['<gpx/>'], 'traseu.gpx', { type: 'application/gpx+xml' }))
  expect(screen.getByText('traseu.gpx')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Înlocuiește fișierul' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Scoate fișierul' }))
  expect(screen.queryByText('traseu.gpx')).not.toBeInTheDocument()
})

test('checkbox keeps native checkbox semantics and its label', async () => {
  const user = userEvent.setup()
  render(
    <label>
      <Checkbox />
      Acceptă plata cash
    </label>,
  )
  const box = screen.getByRole('checkbox', { name: 'Acceptă plata cash' })
  expect(box).not.toBeChecked()
  await user.click(screen.getByText('Acceptă plata cash'))
  expect(box).toBeChecked()
})
