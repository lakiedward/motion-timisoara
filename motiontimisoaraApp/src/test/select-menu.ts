import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export function selectMenuTrigger(label: string | RegExp) {
  return screen.getByRole('button', { name: label })
}

export async function openSelectMenu(label: string | RegExp) {
  const user = userEvent.setup()
  await user.click(selectMenuTrigger(label))
  return user
}

export async function pickSelectMenuOption(label: string | RegExp, option: string | RegExp) {
  const user = await openSelectMenu(label)
  await user.click(await screen.findByRole('menuitemradio', { name: option }))
}

export async function pickSelectMenuValue(trigger: HTMLElement, value: string) {
  const user = userEvent.setup()
  await user.click(trigger)
  const item = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(
      `[role="menuitemradio"][data-value="${CSS.escape(value)}"]`,
    )
    if (!found) throw new Error(`No option with value ${value}`)
    return found
  })
  await user.click(item)
}

export async function selectMenuOptionLabels(trigger: HTMLElement) {
  const user = userEvent.setup()
  await user.click(trigger)
  const labels = (await screen.findAllByRole('menuitemradio')).map((item) => item.textContent ?? '')
  await user.keyboard('{Escape}')
  return labels
}

export async function findSelectMenuOption(trigger: HTMLElement, name: string | RegExp) {
  const user = userEvent.setup()
  await user.click(trigger)
  const option = await screen.findByRole('menuitemradio', { name })
  await user.keyboard('{Escape}')
  return option
}
