import { fireEvent, within } from '@testing-library/react'

import { MONTH_NAMES, cursorFor, formatDateLong, splitDateTime } from '@/lib/date-picker'

function openPanel(trigger: HTMLElement) {
  fireEvent.click(trigger)
  const id = trigger.getAttribute('aria-controls')
  const panel = id ? document.getElementById(id) : null
  if (!panel) throw new Error('Picker panel did not open')
  return panel
}

function pickDate(trigger: HTMLElement, iso: string) {
  const panel = openPanel(trigger)
  if (!iso) {
    fireEvent.click(within(panel).getByRole('button', { name: 'Șterge' }))
    return
  }
  const target = cursorFor(iso)
  for (let guard = 0; guard < 600; guard += 1) {
    const [name, year] = (within(panel).getByRole('grid').getAttribute('aria-label') ?? '').split(' ')
    const delta = (target.year - Number(year)) * 12 + (target.month - MONTH_NAMES.indexOf(name as never))
    if (delta === 0) break
    fireEvent.click(
      within(panel).getByRole('button', { name: delta > 0 ? 'Luna următoare' : 'Luna anterioară' })
    )
  }
  fireEvent.click(within(panel).getByRole('gridcell', { name: formatDateLong(iso) }))
}

function pickTime(trigger: HTMLElement, time: string) {
  const panel = openPanel(trigger)
  const input = within(panel).getByLabelText('Scrie ora')
  fireEvent.change(input, { target: { value: time } })
  fireEvent.submit(input.closest('form') as HTMLFormElement)
}

export function setPickerValue(trigger: HTMLElement, value: string) {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const { date, time } = splitDateTime(value)
    pickDate(trigger, date)
    const row = trigger.parentElement as HTMLElement
    pickTime(within(row).getByRole('button', { name: 'Ora' }), time)
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value === '') {
    pickDate(trigger, value)
  } else {
    pickTime(trigger, value)
  }
}

export function pickerValue(trigger: HTMLElement): string {
  return trigger.parentElement?.querySelector<HTMLInputElement>('input[type="hidden"]')?.value ?? ''
}
