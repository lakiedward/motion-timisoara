import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import { LeaveFormDialog } from './LeaveFormDialog'

test('uses the shared confirm dialog with stay focused first and leave as the destructive action', async () => {
  const onOpenChange = vi.fn()
  const onLeave = vi.fn()
  render(<LeaveFormDialog open onOpenChange={onOpenChange} onLeave={onLeave} />)
  const dialog = screen.getByRole('alertdialog', { name: 'Renunți la modificări?' })
  expect(dialog).toHaveAttribute('data-slot', 'confirm-dialog')
  expect(dialog).toHaveClass('rounded-xl')
  expect(dialog).not.toHaveClass('shadow-lg')
  const ramn = screen.getByRole('button', { name: 'Rămân' })
  expect(ramn).toHaveFocus()
  const renunt = screen.getByRole('button', { name: 'Renunț' })
  expect(ramn.compareDocumentPosition(renunt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await userEvent.click(renunt)
  expect(onLeave).toHaveBeenCalledOnce()
  await userEvent.click(ramn)
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
