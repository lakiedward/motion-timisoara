import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function pickFilter(label: string, option: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)} `) }))
  await user.click(await screen.findByRole('menuitemradio', { name: option }))
}
