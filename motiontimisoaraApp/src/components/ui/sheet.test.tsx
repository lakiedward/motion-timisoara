import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet'

function ControlledSheet() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Deschide detalii
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle>Detalii</SheetTitle>
          <SheetDescription>Conținut</SheetDescription>
        </SheetContent>
      </Sheet>
    </>
  )
}

test('un panou controlat, fără trigger, întoarce focusul pe butonul care l-a deschis', async () => {
  const user = userEvent.setup()
  render(<ControlledSheet />)
  const opener = screen.getByRole('button', { name: 'Deschide detalii' })
  opener.focus()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('dialog')).toBeInTheDocument()

  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(opener).toHaveFocus()
})

test('închis cu butonul „Închide”, focusul revine tot pe rândul deschis', async () => {
  const user = userEvent.setup()
  render(<ControlledSheet />)
  const opener = screen.getByRole('button', { name: 'Deschide detalii' })
  await user.click(opener)
  await user.click(await screen.findByRole('button', { name: 'Închide' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(opener).toHaveFocus()
})
