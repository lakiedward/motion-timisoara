import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import CopyInviteValueButton from './CopyInviteValueButton'

const writeText = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => vi.useRealTimers())

test('copy feedback expires and a later copy restarts its lifetime', async () => {
  render(
    <CopyInviteValueButton
      value="SYNTHETIC"
      label="Copy fixture"
      successMessage="Copied fixture"
    />,
  )
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy fixture' })))
  expect(screen.getByRole('status')).toHaveTextContent('Copied fixture')
  await act(async () => vi.advanceTimersByTime(4000))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy fixture' })))
  await act(async () => vi.advanceTimersByTime(4000))
  expect(screen.getByRole('status')).toHaveTextContent('Copied fixture')
  await act(async () => vi.advanceTimersByTime(1000))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(writeText).toHaveBeenCalledTimes(2)
})

test('clipboard absence reports failure locally and a later retry can succeed', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  render(
    <CopyInviteValueButton
      value="SYNTHETIC"
      label="Copy fixture"
      successMessage="Copied fixture"
    />,
  )
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy fixture' })))
  expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut copia.')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy fixture' })))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Copied fixture')
})

test('automatic clipboard copy runs once under StrictMode effect replay', async () => {
  await act(async () =>
    render(
      <StrictMode>
        <CopyInviteValueButton
          autoCopy
          value="SYNTHETIC"
          label="Copy fixture"
          successMessage="Copied fixture"
        />
      </StrictMode>,
    ),
  )
  expect(writeText).toHaveBeenCalledTimes(1)
  expect(writeText).toHaveBeenCalledWith('SYNTHETIC')
  expect(screen.getByRole('status')).toHaveTextContent('Copied fixture')
  expect(screen.getByRole('button', { name: 'Copy fixture' })).toBeEnabled()
})
